import './site-map.css';
import type { EngineConstants, Phase, SimulationState } from '../../models/Interfaces';
import { earthElevationDeg, solarElevationDeg } from '../../engine/SubsystemEngines';
import { fetchRealGrids } from './realTerrain';
import { fetchColdTraps, fetchPsrGrids } from './coldTraps';
import { rasterize, shade, sunAzimuthDeg, Terrain, type Grid, type SiteGeometry, type View, type XY } from './terrain';

/**
 * South-pole map for the cockpit viewport (Lead, D-104).
 *
 *   const map = renderSiteMap(viewportEl, constants, state, { stage: 'MCR', onSelectSite: (id) => … });
 *   map.update(newState, { stage: 'SRR' });   // after every state change
 *   map.setHour(h, { drilling, linkUp });      // flight playback drives the sun, Earth and outpost
 *   map.destroy();
 *
 * Stage layers: MCR = whole region, tap a site · SRR = pad and plume keep-out ring ·
 * PDR = mast in sun or shadow (the sun circles once per lunar day) · CDR = route and power link
 * into the cold trap · FLY = the whole outpost (mast, route, rover, link), driven by setHour().
 * Terrain is schematic until the LOLA grid is processed; the map says so in its corner.
 */

export type MapStage = Phase | 'FLY';
export interface SiteMapOptions { stage: MapStage; hour?: number; onSelectSite?: (siteId: string) => void }
/** What the flight playback tells the map about the outpost at the current hour. */
export interface FlightOverlay {
  /** The drill is running this hour (the rover is at the cold trap). */
  drilling: boolean;
  /** The outpost can talk to Earth this hour. */
  linkUp: boolean;
  /** Mission over: brownout or logistics failure. */
  failed: boolean;
}
export interface SiteMapHandle {
  element: HTMLElement;
  update(state: SimulationState, opts?: Partial<SiteMapOptions>): void;
  setHour(hour: number, overlay?: FlightOverlay): void;
  destroy(): void;
}

const terrains = new WeakMap<EngineConstants, Terrain>();
/** Overlays the player switched on. Off by default so the terrain reads first; shared by every map on the page. */
const shownLayers = { slope: false, ice: false };
const terrainReady = new WeakMap<Terrain, Promise<void>>();
const terrainFor = (c: EngineConstants) => { let t = terrains.get(c); if (!t) { t = new Terrain(c); terrains.set(c, t); } return t; };
/** Load LOLA grids once per terrain (D-106); resolves even when there are none. */
const realTerrain = (t: Terrain) => { // LOLA heights (D-106) and Diviner cold traps (D-109)
  let p = terrainReady.get(t);
  if (!p) {
    p = Promise.all([fetchRealGrids(), fetchColdTraps(t.coldTrapMaxK), fetchPsrGrids()]).then(([g, ct, psr]) => {
      if (g.length) t.setReal(g);
      if (ct) t.setColdTraps(ct);
      if (psr.length) t.setPsr(psr);
    });
    terrainReady.set(t, p);
  }
  return p;
};

const COLORS = { ok: '#3ddc84', warn: '#ffb020', fail: '#ff4d4f', accent: '#4ea8ff', text: '#e8edf4', muted: '#9aa7b8', sun: '#ffd34d' };

export function renderSiteMap(container: HTMLElement, c: EngineConstants, initial: SimulationState, initialOpts: SiteMapOptions): SiteMapHandle {
  const terrain = terrainFor(c);
  let state = initial;
  let opts: SiteMapOptions = { ...initialOpts };
  let hour = opts.hour ?? 0;
  let hoverId: string | null = null;
  let overlay: FlightOverlay | null = null;
  let anim = 0;

  const root = document.createElement('div');
  root.className = 'sitemap';
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'Map of the lunar south pole');
  const canvas = document.createElement('canvas');
  canvas.className = 'sitemap__canvas';
  const hud = document.createElement('div'); hud.className = 'sitemap__hud';
  const legend = document.createElement('div'); legend.className = 'sitemap__legend';
  const note = document.createElement('div'); note.className = 'sitemap__note';
  const setNote = () => {
    note.textContent = terrain.real.length
      ? `LOLA terrain (NASA) · ${[...new Set(terrain.real.map((g) => `${Math.round(g.resM)} m`))].join(' / ')} grid${terrain.coldTraps ? ' · Diviner cold traps' : ''}${terrain.psr.length ? ' · LOLA permanent shadow' : ''} · schematic outside`
      : 'Schematic terrain · real crater positions · LOLA data pending';
  };
  setNote();
  const tip = document.createElement('div'); tip.className = 'sitemap__tip'; tip.hidden = true;
  root.append(canvas, hud, legend, note, tip);
  container.append(root);

  // Regional view frames every site (and the pole) with a margin.
  const regionView: View = (() => {
    const xs = [0, ...terrain.sites.map((s) => s.pos.x)], ys = [0, ...terrain.sites.map((s) => s.pos.y)];
    const minX = Math.min(...xs) - 18, maxX = Math.max(...xs) + 18, minY = Math.min(...ys) - 18, maxY = Math.max(...ys) + 18;
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, halfKm: Math.max(maxX - minX, maxY - minY) / 2 };
  })();

  // ---- caches -------------------------------------------------------------------------------
  let gridKey = '', grid: Grid | null = null;
  const shadeCache = new Map<string, HTMLCanvasElement>();
  // During fast playback a new sun angle can arrive every frame; re-shade at most this often (ms).
  const FLY_RESHADE_MS = 150;
  let lastImg: HTMLCanvasElement | null = null, lastShadeAt = 0;

  const site = (): SiteGeometry | undefined => terrain.sites.find((s) => s.site.id === state.selectedSite);
  const strict = () => c.difficulty_levels[state.difficulty]?.sensor_gating_strict ?? true;
  /** What the player's instruments can see (sensor gating). */
  const available = () => ({
    slope: !strict() || state.selectedInstruments.includes('ndl'),
    ice: !strict() || state.selectedInstruments.includes('neutron_spec_radiometer'),
  });
  /** What is painted: available and switched on with the legend chips. */
  const layers = () => {
    const a = available();
    return { slope: a.slope && shownLayers.slope, ice: a.ice && shownLayers.ice };
  };

  function view(): View {
    const sg = site();
    if (opts.stage === 'MCR' || !sg) return regionView;
    const p = sg.pos;
    if (opts.stage === 'SRR') {
      const pad = state.selectedLaunchpad ? c.hardware_catalog.launchpads[state.selectedLaunchpad] : null;
      const need = Math.max(pad?.requires_standoff_distance_m ?? 1200, state.padDistanceM ?? 0) / 1000;
      return { cx: p.x, cy: p.y, halfKm: Math.max(1.5, need * 1.35) };
    }
    if ((opts.stage === 'CDR' || opts.stage === 'FLY') && sg.coldTrap) {
      const d = sg.site.distance_to_cold_trap_km;
      return { cx: (p.x + sg.coldTrap.x) / 2, cy: (p.y + sg.coldTrap.y) / 2, halfKm: Math.max(2.5, d * 0.95) };
    }
    return { cx: p.x, cy: p.y, halfKm: 5 };
  }

  const sunElevation = () => {
    const sg = site();
    return sg && opts.stage !== 'MCR' ? solarElevationDeg(c, sg.site, hour) : 1.5;
  };

  function baseImage(v: View, n: number): HTMLCanvasElement {
    const key = `${v.cx.toFixed(2)}|${v.cy.toFixed(2)}|${v.halfKm.toFixed(2)}|${n}`;
    if (key !== gridKey) { grid = rasterize(terrain, v, n, n); gridKey = key; shadeCache.clear(); }
    const L = layers();
    const fly = opts.stage === 'FLY';
    const az = Math.round(sunAzimuthDeg(c, hour) / (fly ? 15 : 10)) * (fly ? 15 : 10);
    const el = fly ? Math.round(sunElevation()) : Math.round(sunElevation() * 4) / 4;
    const skey = `${az}|${el}|${L.slope}|${L.ice}`;
    let img = shadeCache.get(skey);
    if (!img && fly && lastImg && performance.now() - lastShadeAt < FLY_RESHADE_MS) return lastImg;
    if (!img) {
      lastShadeAt = performance.now();
      const px = shade(grid!, az, el, L);
      img = document.createElement('canvas'); img.width = n; img.height = n;
      img.getContext('2d')!.putImageData(new ImageData(px as Uint8ClampedArray<ArrayBuffer>, n, n), 0, 0);
      if (shadeCache.size > (fly ? 120 : 40)) shadeCache.clear();
      shadeCache.set(skey, img);
    }
    lastImg = img;
    return img;
  }

  // ---- drawing --------------------------------------------------------------------------------
  let toScreen: (p: XY) => XY = (p) => p;
  let pxPerKm = 1;

  function draw(): void {
    const rect = root.getBoundingClientRect();
    const W = Math.max(200, rect.width), H = Math.max(200, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#05070b'; g.fillRect(0, 0, W, H);

    const v = view();
    const side = Math.min(W, H);
    pxPerKm = side / (2 * v.halfKm);
    toScreen = (p) => ({ x: W / 2 + (p.x - v.cx) * pxPerKm, y: H / 2 - (p.y - v.cy) * pxPerKm });
    const n = opts.stage === 'MCR' ? 360 : opts.stage === 'FLY' ? 240 : 300;
    const img = baseImage(v, n);
    // fill the whole viewport (extra terrain beyond the square is cropped, the map stays undistorted)
    const regional = opts.stage === 'MCR' || !site();
    const scale = regional ? 1 : Math.max(W, H) / side; // regional: show everything; close-ups: fill the viewport
    const S = side * scale;
    g.imageSmoothingEnabled = true;
    g.drawImage(img, (W - S) / 2, (H - S) / 2, S, S);
    // the raster covers `side`; when scaled up to cover the long edge, adjust px-per-km accordingly
    pxPerKm *= scale;
    toScreen = (p) => ({ x: W / 2 + (p.x - v.cx) * pxPerKm, y: H / 2 - (p.y - v.cy) * pxPerKm });

    g.font = '12px system-ui, sans-serif';
    if (opts.stage === 'MCR' || !site()) drawRegion(g, W, H);
    else if (opts.stage === 'SRR') drawPad(g);
    else if (opts.stage === 'CDR') drawColdTrap(g);
    else if (opts.stage === 'FLY') drawFlight(g);
    else drawPower(g);
    drawCompass(g, W, H);
    drawScale(g, W, H);
    renderHud();
  }

  function label(g: CanvasRenderingContext2D, text: string, p: XY, color = COLORS.text, dy = -14) {
    g.save(); g.font = '600 12px system-ui, sans-serif'; g.textAlign = 'center';
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(text, p.x, p.y + dy);
    g.fillStyle = color; g.fillText(text, p.x, p.y + dy); g.restore();
  }

  function mcrVerdict(sg: SiteGeometry): 'ok' | 'fail' {
    const s = c.simulation;
    return sg.site.slope_deg <= s.max_touchdown_slope_deg && sg.site.earth_visibility_fraction >= s.min_earth_visibility_fraction ? 'ok' : 'fail';
  }

  function drawRegion(g: CanvasRenderingContext2D, W: number, H: number) {
    g.save(); g.font = 'italic 11px system-ui, sans-serif'; g.fillStyle = 'rgba(210,220,235,0.7)'; g.textAlign = 'center';
    for (const cl of terrain.craterLabels()) { const p = toScreen(cl.pos); if (p.x > 0 && p.x < W && p.y > 0 && p.y < H) g.fillText(cl.name, p.x, p.y + 4); }
    g.restore();
    const showVerdict = available().slope; // slope known only with the lidar (or in Cadet)
    for (const sg of terrain.sites) {
      const p = toScreen(sg.pos);
      const selected = sg.site.id === state.selectedSite;
      const hov = sg.site.id === hoverId;
      g.beginPath(); g.arc(p.x, p.y, selected || hov ? 11 : 8, 0, 2 * Math.PI);
      g.fillStyle = showVerdict ? (mcrVerdict(sg) === 'ok' ? COLORS.ok : COLORS.fail) : COLORS.accent;
      g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
      g.lineWidth = selected ? 3 : 1.5; g.strokeStyle = selected ? '#fff' : 'rgba(0,0,0,0.8)'; g.stroke();
      label(g, sg.site.name, p, selected ? '#fff' : COLORS.text, -16);
    }
  }

  function ring(g: CanvasRenderingContext2D, center: XY, rKm: number, color: string, dash: number[], text?: string) {
    const p = toScreen(center);
    g.save(); g.beginPath(); g.arc(p.x, p.y, rKm * pxPerKm, 0, 2 * Math.PI);
    g.setLineDash(dash); g.lineWidth = 2; g.strokeStyle = color; g.stroke(); g.restore();
    if (text) label(g, text, { x: p.x, y: p.y - rKm * pxPerKm }, color, -6);
  }

  function drawPad(g: CanvasRenderingContext2D) {
    const sg = site()!;
    const pad = state.selectedLaunchpad ? c.hardware_catalog.launchpads[state.selectedLaunchpad] : null;
    const p = toScreen(sg.pos);
    g.fillStyle = '#d9dee7'; g.fillRect(p.x - 7, p.y - 7, 14, 14);
    label(g, pad ? pad.name : 'Landing pad (choose a type)', p, COLORS.text, -14);
    if (pad) ring(g, sg.pos, pad.requires_standoff_distance_m / 1000, COLORS.fail, [6, 5], `plume keep-out ${pad.requires_standoff_distance_m} m`);
    const d = state.padDistanceM;
    if (d != null && d > 0) {
      const arr = { x: sg.pos.x + d / 1000, y: sg.pos.y };
      const q = toScreen(arr);
      const safe = !pad || d >= pad.requires_standoff_distance_m;
      g.save(); g.setLineDash([3, 4]); g.strokeStyle = COLORS.muted; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); g.restore();
      g.fillStyle = safe ? COLORS.ok : COLORS.fail; g.fillRect(q.x - 3, q.y - 12, 6, 24);
      label(g, `solar mast · ${d} m ${safe ? '✓ safe' : '✗ in the plume'}`, q, safe ? COLORS.ok : COLORS.fail, 28);
    }
  }

  function mastLit(): { lit: boolean; el: number; cutoff: number; name: string } {
    const sg = site()!;
    const mast = c.hardware_catalog.power_masts[state.selectedMast ?? 'mast_10m_vsat'];
    const el = solarElevationDeg(c, sg.site, hour);
    return { lit: el >= mast.cutoff_elevation_deg, el, cutoff: mast.cutoff_elevation_deg, name: mast.name };
  }

  function drawPower(g: CanvasRenderingContext2D) {
    const sg = site()!;
    const p = toScreen(sg.pos);
    const m = mastLit();
    g.save(); g.lineWidth = 3; g.strokeStyle = m.lit ? COLORS.sun : '#5b6575';
    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x, p.y - 26); g.stroke();
    g.fillStyle = m.lit ? COLORS.sun : '#5b6575'; g.fillRect(p.x - 5, p.y - 30, 10, 14); g.restore();
    label(g, m.lit ? `${m.name} · in sunlight` : `${m.name} · in shadow`, p, m.lit ? COLORS.sun : COLORS.muted, -38);
    if (sg.coldTrap) label(g, 'cold trap', toScreen(sg.coldTrap), '#8fb8ff', 4);
  }

  function drawColdTrap(g: CanvasRenderingContext2D) {
    const sg = site()!;
    if (!sg.coldTrap) { drawPower(g); return; }
    const a = toScreen(sg.pos), b = toScreen(sg.coldTrap);
    const lg = state.selectedLogistics ? c.hardware_catalog.cold_trap_logistics[state.selectedLogistics] : null;
    const link = state.selectedUtilityLink ? c.hardware_catalog.utility_links[state.selectedUtilityLink] : null;
    const routeOk = !lg || lg.max_slope_deg >= sg.site.max_route_slope_deg;
    g.save(); g.lineWidth = 4; g.strokeStyle = lg ? (routeOk ? COLORS.ok : COLORS.fail) : COLORS.muted;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.restore();
    if (link) {
      const inRange = link.max_range_km == null || link.max_range_km >= sg.site.distance_to_cold_trap_km;
      g.save(); g.lineWidth = 2; g.setLineDash(link.attenuated_by_dust ? [10, 6] : []);
      g.strokeStyle = inRange ? (link.attenuated_by_dust ? '#ff5a5a' : '#ff9a3c') : COLORS.fail;
      g.beginPath(); g.moveTo(a.x + 8, a.y); g.lineTo(b.x + 8, b.y); g.stroke(); g.restore();
      const mid = { x: (a.x + b.x) / 2 + 10, y: (a.y + b.y) / 2 };
      label(g, `${link.name}${inRange ? '' : ' · out of range'}`, mid, inRange ? COLORS.text : COLORS.fail, 18);
    }
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    label(g, `route up to ${sg.site.max_route_slope_deg}°${lg ? ` · ${lg.name} ${routeOk ? 'can climb it' : `max ${lg.max_slope_deg}°`}` : ''}`, mid, lg ? (routeOk ? COLORS.ok : COLORS.fail) : COLORS.text, -10);
    g.fillStyle = '#d9dee7'; g.fillRect(a.x - 6, a.y - 6, 12, 12);
    label(g, sg.site.name, a, COLORS.text, -14);
    g.beginPath(); g.arc(b.x, b.y, 7, 0, 2 * Math.PI); g.fillStyle = '#8fb8ff'; g.fill();
    label(g, `cold trap · ${sg.site.ambient_cold_trap_temperature_k} K`, b, '#8fb8ff', 22);
  }

  function drawFlight(g: CanvasRenderingContext2D) {
    const sg = site()!;
    const a = toScreen(sg.pos);
    const m = mastLit();
    const o = overlay ?? { drilling: false, linkUp: true, failed: false };
    const t = performance.now() / 1000;
    if (sg.coldTrap) {
      const b = toScreen(sg.coldTrap);
      const link = state.selectedUtilityLink ? c.hardware_catalog.utility_links[state.selectedUtilityLink] : null;
      g.save(); g.lineWidth = 3; g.strokeStyle = 'rgba(232,237,244,0.35)'; g.setLineDash([2, 5]);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.restore();
      if (link) {
        const live = o.drilling && !o.failed;
        g.save(); g.lineWidth = live ? 3 : 1.5; g.setLineDash(link.attenuated_by_dust ? [10, 6] : []);
        g.lineDashOffset = live ? -t * 30 : 0;
        g.strokeStyle = live ? '#ff9a3c' : 'rgba(255,154,60,0.35)';
        g.beginPath(); g.moveTo(a.x + 8, a.y); g.lineTo(b.x + 8, b.y); g.stroke(); g.restore();
      }
      g.beginPath(); g.arc(b.x, b.y, 7, 0, 2 * Math.PI); g.fillStyle = '#8fb8ff'; g.fill();
      label(g, 'cold trap', b, '#8fb8ff', 22);
      // rover: at the cold trap while drilling, parked at the outpost otherwise
      const r = o.drilling ? b : { x: a.x + 14, y: a.y + 10 };
      g.beginPath(); g.arc(r.x, r.y, 5, 0, 2 * Math.PI); g.fillStyle = o.failed ? COLORS.muted : COLORS.ok; g.fill();
      if (o.drilling && !o.failed) {
        g.beginPath(); g.arc(r.x, r.y, 9 + 4 * Math.sin(t * 6), 0, 2 * Math.PI); g.strokeStyle = COLORS.ok; g.lineWidth = 1.5; g.stroke();
        label(g, 'drilling', r, COLORS.ok, -12);
      }
    }
    // mast
    g.save(); g.lineWidth = 3; g.strokeStyle = m.lit ? COLORS.sun : '#5b6575';
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(a.x, a.y - 26); g.stroke();
    g.fillStyle = m.lit ? COLORS.sun : '#5b6575'; g.fillRect(a.x - 5, a.y - 30, 10, 14); g.restore();
    g.fillStyle = o.failed ? COLORS.fail : '#d9dee7'; g.fillRect(a.x - 6, a.y - 6, 12, 12);
    // Earth link: a beam toward Earth (map up) when there is line of sight
    if (o.linkUp && !o.failed) {
      g.save(); g.strokeStyle = COLORS.accent; g.lineWidth = 2; g.setLineDash([4, 6]); g.lineDashOffset = t * 20;
      g.beginPath(); g.moveTo(a.x, a.y - 32); g.lineTo(a.x, a.y - 90); g.stroke(); g.restore();
    }
    label(g, o.failed ? `${sg.site.name} · offline` : `${sg.site.name} · ${m.lit ? 'in sunlight' : 'night: survival mode'}`, a,
      o.failed ? COLORS.fail : m.lit ? COLORS.sun : COLORS.muted, -40);
  }

  function drawCompass(g: CanvasRenderingContext2D, W: number, H: number) {
    // Earth is always toward 0°E (up); the Sun circles the horizon once per lunar day.
    const sg = site();
    const earthUp = sg ? earthElevationDeg(c, sg.site, hour) >= c.simulation.min_earth_elevation_for_los_deg : true;
    // FLY: the playback's gauges sit along the top edge, so the Earth label goes just below them.
    label(g, earthUp ? '▲ Earth' : '▲ Earth (below horizon)', { x: W / 2, y: opts.stage === 'FLY' ? 132 : 22 }, earthUp ? COLORS.accent : COLORS.muted, 0);
    const az = sunAzimuthDeg(c, hour) * Math.PI / 180;
    const R = Math.min(W, H) / 2 - 18;
    const sp = { x: W / 2 + R * Math.sin(az), y: H / 2 - R * Math.cos(az) };
    g.beginPath(); g.arc(sp.x, sp.y, 9, 0, 2 * Math.PI); g.fillStyle = COLORS.sun; g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.5; g.stroke();
    label(g, 'Sun', sp, COLORS.sun, -14);
  }

  function drawScale(g: CanvasRenderingContext2D, W: number, H: number) {
    const targetPx = 110;
    const km = targetPx / pxPerKm;
    const nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50].find((k) => k >= km * 0.6) ?? 50;
    const len = nice * pxPerKm;
    const x = W - len - 20, y = H - 30;
    g.fillStyle = '#e8edf4'; g.fillRect(x, y, len, 3);
    g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(nice < 1 ? `${nice * 1000} m` : `${nice} km`, x + len / 2, y - 6);
  }

  function renderHud(): void {
    const sg = site();
    const L = layers();
    const stageText: Record<MapStage, string> = {
      MCR: 'Lunar south pole · tap a site',
      SRR: 'Landing pad and plume keep-out',
      PDR: 'Power: watch the mast through a lunar day',
      CDR: 'Route and power link into the cold trap',
      PLAR: 'Flight', FLY: 'Flight: one year at the outpost',
    };
    let line2 = '';
    if (sg && opts.stage !== 'MCR') {
      const day = Math.floor(hour / 24);
      const el = solarElevationDeg(c, sg.site, hour);
      line2 = `Day ${day} · Sun ${el.toFixed(1)}° above the horizon`;
    }
    hud.replaceChildren(
      Object.assign(document.createElement('strong'), { textContent: stageText[opts.stage] }),
      ...(line2 ? [Object.assign(document.createElement('span'), { textContent: line2 })] : []),
    );
    const A = available();
    const chip = (key: 'slope' | 'ice', text: string, lockedHint: string) => {
      const el = document.createElement('button');
      el.type = 'button';
      if (!A[key]) {
        el.className = 'sitemap__chip is-locked';
        el.textContent = `🔒 ${text}`;
        el.title = lockedHint;
        el.disabled = true;
        return el;
      }
      el.className = `sitemap__chip${L[key] ? ' is-on' : ''}`;
      el.textContent = text;
      el.setAttribute('aria-pressed', String(L[key]));
      el.title = L[key] ? `Hide the ${text.toLowerCase()}` : `Show the ${text.toLowerCase()}`;
      el.addEventListener('click', () => { shownLayers[key] = !shownLayers[key]; draw(); });
      return el;
    };
    legend.replaceChildren(
      chip('slope', 'Slope map', 'Add the Navigation Doppler Lidar to see slopes'),
      chip('ice', 'Ice map', 'Add the Neutron spectrometer & thermal radiometer to see cold traps'),
    );
  }

  // ---- interaction ------------------------------------------------------------------------------
  function siteAt(clientX: number, clientY: number): SiteGeometry | null {
    if (opts.stage !== 'MCR' && site()) return null;
    const r = canvas.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    let best: SiteGeometry | null = null, bd = 24; // 24 px touch radius
    for (const sg of terrain.sites) { const p = toScreen(sg.pos); const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = sg; } }
    return best;
  }
  const pct = (f: number) => `${Math.round(f * 100)}%`;
  function onMove(e: PointerEvent) {
    const sg = siteAt(e.clientX, e.clientY);
    const id = sg?.site.id ?? null;
    if (id !== hoverId) { hoverId = id; draw(); }
    canvas.style.cursor = sg ? 'pointer' : 'default';
    if (!sg) { tip.hidden = true; return; }
    const L = available();
    tip.hidden = false;
    tip.replaceChildren(
      Object.assign(document.createElement('strong'), { textContent: sg.site.name }),
      Object.assign(document.createElement('span'), { textContent: `Sunlit ${pct(sg.site.illumination_fraction)} of the year · Earth visible ${pct(sg.site.earth_visibility_fraction)}` }),
      Object.assign(document.createElement('span'), { textContent: L.slope ? `Slope ${sg.site.slope_deg}° (limit ${c.simulation.max_touchdown_slope_deg}°)` : 'Slope unknown: add the lidar' }),
      Object.assign(document.createElement('span'), { textContent: sg.site.distance_to_cold_trap_km > 0 ? `Cold trap ${sg.site.distance_to_cold_trap_km} km away` : 'On the cold-trap floor' }),
    );
    const r = root.getBoundingClientRect();
    tip.style.left = `${Math.min(r.width - 230, e.clientX - r.left + 14)}px`;
    tip.style.top = `${Math.max(8, e.clientY - r.top - 10)}px`;
  }
  function onClick(e: PointerEvent) {
    const sg = siteAt(e.clientX, e.clientY);
    if (sg && opts.onSelectSite) opts.onSelectSite(sg.site.id);
  }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; if (hoverId) { hoverId = null; draw(); } });
  canvas.addEventListener('pointerup', onClick);

  // PDR: let the sun circle once per lunar day so shadows can be seen (stops in other stages and during FLY).
  function loop(t0: number) {
    const T = c.system_constants.synodic_month_days * 24;
    const tick = (t: number) => {
      if (opts.stage !== 'PDR') { anim = 0; return; }
      hour = (((t - t0) / 14000) * T) % T; // one lunar day every 14 s
      draw();
      anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }
  const syncAnimation = () => {
    if (opts.stage === 'PDR' && !anim && site()) loop(performance.now());
  };

  const ro = new ResizeObserver(() => draw());
  ro.observe(root);
  draw();
  syncAnimation();
  let alive = true;
  // Swap in LOLA heights when they arrive (the first frame uses schematic terrain).
  void realTerrain(terrain).then(() => {
    if (!alive || (!terrain.real.length && !terrain.coldTraps)) return;
    gridKey = ''; shadeCache.clear(); lastImg = null; setNote(); draw();
  });

  return {
    element: root,
    update(next, o) {
      state = next;
      if (o) opts = { ...opts, ...o };
      if (o?.hour != null) hour = o.hour;
      if (opts.stage !== 'PDR' && opts.stage !== 'FLY' && o?.hour == null) hour = 0;
      draw();
      syncAnimation();
    },
    setHour(h, o) { hour = h; if (o) overlay = o; if (!anim) draw(); },
    destroy() { alive = false; cancelAnimationFrame(anim); ro.disconnect(); root.remove(); },
  };
}
