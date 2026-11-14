import type { EngineConstants, LandingSite, MapFeatures } from '../../models/Interfaces';
import { stackHeight, type RealGrid } from './realTerrain';

/**
 * South-polar terrain (pure, no DOM). Where LOLA grids are loaded (setReal, D-106) heights are real;
 * elsewhere, and until they load, the height field is synthetic: real craters at their approximate positions (constants.map_features) plus gentle noise,
 * and a small local cold trap for each site at the catalog's distance. Clearly labelled as schematic on screen.
 *
 * Coordinates: south polar stereographic, km. 0° E points up (+y), 90° E to the right (+x),
 * the same orientation as LOLA south-pole maps.
 */

export interface XY { x: number; y: number }
export interface View { cx: number; cy: number; halfKm: number }

const DEG = Math.PI / 180;

export function toXY(latDeg: number, lonDeg: number, moonRadiusKm: number): XY {
  const r = 2 * moonRadiusKm * Math.tan(((90 + latDeg) / 2) * DEG); // latDeg is negative near the south pole
  return { x: r * Math.sin(lonDeg * DEG), y: r * Math.cos(lonDeg * DEG) };
}

// ---- deterministic value noise -------------------------------------------------------------
function hash(ix: number, iy: number): number {
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy - 0.5;
}
/** Fractal noise, amplitude ≈ ±amp km, base wavelength `scaleKm`. */
function fbm(x: number, y: number, scaleKm: number, amp: number, octaves: number): number {
  let sum = 0, a = amp, f = 1 / scaleKm;
  for (let o = 0; o < octaves; o++) { sum += a * valueNoise(x * f + o * 17.3, y * f - o * 9.1); a *= 0.5; f *= 2.1; }
  return sum;
}

interface Bowl { x: number; y: number; r: number; depth: number; psr: boolean; name?: string; /** invented cold trap: hidden where LOLA heights exist */ local?: boolean }
interface Bump { x: number; y: number; r: number; h: number }

export interface SiteGeometry { site: LandingSite; pos: XY; coldTrap: XY | null; bearingDeg: number }

export class Terrain {
  readonly bowls: Bowl[] = [];
  readonly bumps: Bump[] = [];
  readonly sites: SiteGeometry[] = [];
  readonly moonR: number;
  /** LOLA grids, finest first (empty = schematic everywhere). */
  real: RealGrid[] = [];

  constructor(c: EngineConstants) {
    const f: MapFeatures = c.map_features;
    this.moonR = f.moon_radius_km;
    for (const cr of f.craters) {
      const p = toXY(cr.lat_deg, cr.lon_deg, this.moonR);
      this.bowls.push({ x: p.x, y: p.y, r: cr.radius_km, depth: cr.depth_km, psr: cr.permanently_shadowed, name: cr.name });
    }
    for (const m of f.massifs) {
      const p = toXY(m.lat_deg, m.lon_deg, this.moonR);
      this.bumps.push({ x: p.x, y: p.y, r: m.radius_km, h: m.height_km });
    }
    // Each site: on raised ground (unless its mean sun is below the horizon, i.e. a crater floor),
    // with a local cold trap at the catalog distance, toward the nearest big permanently shadowed crater.
    for (const site of Object.values(c.site_catalog)) {
      const pos = toXY(site.latitude_deg, site.longitude_deg, this.moonR);
      let best: Bowl | null = null, bestD = Infinity;
      for (const b of this.bowls) {
        if (!b.psr) continue;
        const d = Math.hypot(b.x - pos.x, b.y - pos.y);
        if (d < bestD) { bestD = d; best = b; }
      }
      const ang = best ? Math.atan2(best.x - pos.x, best.y - pos.y) : 0;
      const dist = site.distance_to_cold_trap_km;
      const coldTrap = dist > 0 ? { x: pos.x + dist * Math.sin(ang), y: pos.y + dist * Math.cos(ang) } : null;
      if (coldTrap) {
        const r = Math.min(2.5, Math.max(0.7, dist * 0.6));
        this.bowls.push({ x: coldTrap.x, y: coldTrap.y, r, depth: r * 0.45, psr: true, local: true });
      }
      if (site.solar_elevation_mean_deg > 0) this.bumps.push({ x: pos.x, y: pos.y, r: 1.6, h: 0.45 });
      this.sites.push({ site, pos, coldTrap, bearingDeg: ((ang / DEG) + 360) % 360 });
    }
    // Small craters give the lunar texture: a regional population and a fine one around each site.
    const rnd = (n: number) => hash(n, 7919);
    for (let n = 0; n < 160; n++) {
      const a = rnd(n) * 2 * Math.PI, d = 150 * Math.sqrt(rnd(n + 1000));
      const r = 1 + 5 * rnd(n + 2000) ** 2;
      this.bowls.push({ x: d * Math.sin(a), y: d * Math.cos(a), r, depth: r * 0.22, psr: false });
    }
    this.sites.forEach((sg, si) => {
      for (let n = 0; n < 70; n++) {
        const k = 5000 + si * 100 + n;
        const a = rnd(k) * 2 * Math.PI, d = 6 * Math.sqrt(rnd(k + 1)) + 0.25;
        const r = 0.05 + 0.4 * rnd(k + 2) ** 2;
        this.bowls.push({ x: sg.pos.x + d * Math.sin(a), y: sg.pos.y + d * Math.cos(a), r, depth: r * 0.2, psr: false });
      }
    });
  }

  setReal(grids: RealGrid[]): void { this.real = grids; }

  /** Height in km at (x, y). */
  height(x: number, y: number): number {
    if (this.real.length) {
      const r = stackHeight(this.real, x, y);
      if (Number.isFinite(r)) return r;
    }
    let h = fbm(x, y, 18, 0.35, 4) + fbm(x, y, 0.9, 0.025, 3);
    for (const m of this.bumps) {
      const d2 = ((x - m.x) ** 2 + (y - m.y) ** 2) / (m.r * m.r);
      if (d2 < 9) h += m.h * Math.exp(-d2 * 1.6);
    }
    for (const b of this.bowls) {
      const ex = 2.2 * b.r;
      if (x - b.x > ex || b.x - x > ex || y - b.y > ex || b.y - y > ex) continue;
      const d = Math.hypot(x - b.x, y - b.y) / b.r;
      if (d < 1) h -= b.depth * (1 - d * d);
      else if (d < 2.2) h += 0.18 * b.depth * Math.exp(-(((d - 1) / 0.28) ** 2));
    }
    return h;
  }

  /** True where a permanently shadowed crater floor lies (never sunlit, cold trap). */
  isPermanentShadow(x: number, y: number): boolean {
    let realHere: boolean | null = null;
    for (const b of this.bowls) {
      if (!b.psr || Math.abs(x - b.x) >= b.r || Math.abs(y - b.y) >= b.r || Math.hypot(x - b.x, y - b.y) >= b.r * 0.82) continue;
      if (b.local) {
        // the invented per-site cold trap has no place on real terrain; the map still marks its position
        realHere ??= this.real.length > 0 && Number.isFinite(stackHeight(this.real, x, y));
        if (realHere) continue;
      }
      return true;
    }
    return false;
  }

  craterLabels(): Array<{ name: string; pos: XY; r: number }> {
    return this.bowls.filter((b) => b.name).map((b) => ({ name: b.name!, pos: { x: b.x, y: b.y }, r: b.r }));
  }
}

// ---- rasterising and shading -----------------------------------------------------------------

export interface Grid { w: number; h: number; kmPerPx: number; view: View; z: Float32Array; psr: Uint8Array }

export function rasterize(t: Terrain, view: View, w: number, h: number): Grid {
  const kmPerPx = (2 * view.halfKm) / Math.min(w, h);
  const z = new Float32Array(w * h);
  const psr = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    const y = view.cy + (h / 2 - j - 0.5) * kmPerPx;
    for (let i = 0; i < w; i++) {
      const x = view.cx + (i + 0.5 - w / 2) * kmPerPx;
      z[j * w + i] = t.height(x, y);
      psr[j * w + i] = t.isPermanentShadow(x, y) ? 1 : 0;
    }
  }
  return { w, h, kmPerPx, view, z, psr };
}

export interface ShadeLayers { slope: boolean; ice: boolean }

/** Slope in degrees at grid cell (i, j). */
export function slopeAt(g: Grid, i: number, j: number): number {
  const { w, h, z, kmPerPx } = g;
  const xl = z[j * w + Math.max(0, i - 1)], xr = z[j * w + Math.min(w - 1, i + 1)];
  const yu = z[Math.max(0, j - 1) * w + i], yd = z[Math.min(h - 1, j + 1) * w + i];
  const dzdx = (xr - xl) / (2 * kmPerPx), dzdy = (yu - yd) / (2 * kmPerPx);
  return Math.atan(Math.hypot(dzdx, dzdy)) / DEG;
}

/**
 * Low-sun shading with cast shadows. sunAzDeg uses map bearing (0 = up, 90 = right).
 * Returns RGBA pixels for the grid.
 */
export function shade(g: Grid, sunAzDeg: number, sunElDeg: number, layers: ShadeLayers): Uint8ClampedArray {
  const { w, h, z, psr, kmPerPx } = g;
  const out = new Uint8ClampedArray(w * h * 4);
  const el = Math.max(0.3, sunElDeg) * DEG;
  const sx = Math.cos(el) * Math.sin(sunAzDeg * DEG), sy = Math.cos(el) * Math.cos(sunAzDeg * DEG), sz = Math.sin(el);
  const tanEl = Math.tan(el);
  const stepX = Math.sin(sunAzDeg * DEG), stepY = -Math.cos(sunAzDeg * DEG); // grid j grows downward
  const maxSteps = Math.min(220, Math.ceil(Math.max(w, h) * 0.8));
  const sunUp = sunElDeg > -1.0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const xl = z[j * w + Math.max(0, i - 1)], xr = z[j * w + Math.min(w - 1, i + 1)];
      const yu = z[Math.max(0, j - 1) * w + i], yd = z[Math.min(h - 1, j + 1) * w + i];
      const dzdx = (xr - xl) / (2 * kmPerPx), dzdy = (yu - yd) / (2 * kmPerPx);
      const nl = Math.hypot(dzdx, dzdy, 1);
      const nx = -dzdx / nl, ny = -dzdy / nl, nz = 1 / nl;
      let lit = sunUp && !psr[k] ? Math.max(0, nx * sx + ny * sy + nz * sz) : 0;
      if (lit > 0) {
        // march toward the sun; any terrain above the ray casts a shadow
        const z0 = z[k] + 0.002;
        for (let s = 1; s < maxSteps; s++) {
          const ii = Math.round(i + stepX * s), jj = Math.round(j + stepY * s);
          if (ii < 0 || jj < 0 || ii >= w || jj >= h) break;
          if (z[jj * w + ii] > z0 + s * kmPerPx * tanEl) { lit = 0; break; }
        }
      }
      // earthshine-like ambient from the top (Earth side) keeps shadowed relief readable
      const relief = Math.max(0, 0.5 + 0.5 * (ny * 0.7 - nx * 0.3) * 4); // fixed soft light so dark relief still reads
      const amb = 0.035 + 0.07 * Math.min(1, relief);
      const v = Math.min(1, amb + lit * 3.2);
      let r = 22 + 214 * v, gg = 24 + 210 * v, b = 32 + 200 * v;
      if (psr[k]) {
        // permanently shadowed floor: keep the relief, tint it (blue when the ice layer is on)
        const [tr, tg, tb, a] = layers.ice ? [40, 110, 230, 0.55] : [10, 14, 34, 0.35];
        r = r * (1 - a) + tr * a; gg = gg * (1 - a) + tg * a; b = b * (1 - a) + tb * a;
      }
      if (layers.slope) {
        const sl = slopeAt(g, i, j);
        const [cr, cg, cb] = sl <= 8 ? [40, 200, 90] : sl <= 14 ? [235, 190, 40] : [230, 60, 60];
        r = r * 0.55 + cr * 0.45; gg = gg * 0.55 + cg * 0.45; b = b * 0.55 + cb * 0.45;
      }
      out[k * 4] = r; out[k * 4 + 1] = gg; out[k * 4 + 2] = b; out[k * 4 + 3] = 255;
    }
  }
  return out;
}

/** Sun bearing on the map at a given mission hour: one full turn per synodic month. */
export function sunAzimuthDeg(c: EngineConstants, hour: number): number {
  const T = c.system_constants.synodic_month_days * 24;
  return ((hour / T) * 360 + c.map_features.sun_azimuth_at_hour0_deg) % 360;
}
