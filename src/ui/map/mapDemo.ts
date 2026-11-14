import type { EngineConstants, SimulationState } from '../../models/Interfaces';
import { initialState, REFERENCE_DESIGN } from '../../models/StateStore';
import { h } from '../dom';
import { renderSiteMap, type MapStage } from './SiteMap';
import { createFlightPlayback, type FlightPlaybackHandle } from './FlightPlayback';
import { provisionalDesign } from '../DesignFlow';
import { runMission } from '../../engine/SimulationClock';

/**
 * Test page for the map at #map (Lead). Lets anyone try every stage layer before the
 * cockpit console mounts the map. Not part of the game flow.
 */
export function renderMapDemo(app: HTMLElement, c: EngineConstants): void {
  let state: SimulationState = { ...initialState(c), ...REFERENCE_DESIGN, selectedInstruments: ['trident_drill'] };
  let stage: MapStage = 'MCR';
  let flight: FlightPlaybackHandle | null = null;

  const viewport = h('div', { class: 'mapdemo__viewport' });
  const bar = h('div', { class: 'mapdemo__bar' });
  const info = h('span', { class: 'mapdemo__info' });
  app.replaceChildren(h('div', { class: 'mapdemo' }, bar, viewport));

  const map = renderSiteMap(viewport, c, state, {
    stage,
    onSelectSite: (id) => { set({ selectedSite: id }); },
  });

  function set(patch: Partial<SimulationState>) { state = { ...state, ...patch }; if (stage !== 'FLY') map.update(state, { stage }); paint(); }

  function fly() {
    const { design } = provisionalDesign(c, state);
    if (!design) { info.textContent = 'Pick a site first'; return; }
    const result = runMission(c, design, { seed: state.seed, randomEvents: c.difficulty_levels[state.difficulty].random_events_enabled, logEveryHours: 1 });
    stage = 'FLY';
    map.element.hidden = true;
    flight?.destroy();
    flight = createFlightPlayback(viewport, c, state, result, { onFinish: () => { info.textContent = 'onFinish() → the cockpit shows the debrief here'; } });
    paint();
  }
  function leaveFlight() { flight?.destroy(); flight = null; map.element.hidden = false; }

  const select = (label: string, table: Record<string, { name: string }>, key: keyof SimulationState) => {
    const sel = h('select', { 'aria-label': label });
    for (const [id, v] of Object.entries(table)) {
      const o = h('option', { value: id }, v.name);
      if (state[key] === id) o.setAttribute('selected', '');
      sel.append(o);
    }
    sel.addEventListener('change', () => set({ [key]: sel.value } as Partial<SimulationState>));
    return h('label', {}, `${label} `, sel);
  };
  const toggle = (label: string, id: string) => {
    const cb = h('input', { type: 'checkbox' });
    cb.checked = state.selectedInstruments.includes(id); // the bar is rebuilt on every change
    cb.addEventListener('change', () => set({ selectedInstruments: cb.checked ? [...state.selectedInstruments, id] : state.selectedInstruments.filter((i) => i !== id) }));
    return h('label', {}, cb, ` ${label}`);
  };
  const distance = h('input', { type: 'number', value: String(state.padDistanceM ?? 800), step: '100', min: '0', style: 'width:6em' });
  distance.addEventListener('input', () => set({ padDistanceM: Number(distance.value) || 0 }));

  function paint() {
    bar.replaceChildren(
      ...(['MCR', 'SRR', 'PDR', 'CDR'] as MapStage[]).map((s) => {
        const b = h('button', { type: 'button', class: s === stage ? 'is-active' : '' }, s);
        b.addEventListener('click', () => { leaveFlight(); stage = s; map.update(state, { stage }); paint(); });
        return b;
      }),
      (() => { const b = h('button', { type: 'button', class: stage === 'FLY' ? 'is-active' : '' }, 'FLY ▶'); b.addEventListener('click', fly); return b; })(),
      select('Site', c.site_catalog, 'selectedSite'),
      ...(stage === 'SRR' ? [select('Pad', c.hardware_catalog.launchpads, 'selectedLaunchpad'), h('label', {}, 'Distance m ', distance)] : []),
      ...(stage === 'PDR' ? [select('Mast', c.hardware_catalog.power_masts, 'selectedMast')] : []),
      ...(stage === 'CDR' ? [select('Logistics', c.hardware_catalog.cold_trap_logistics, 'selectedLogistics'), select('Link', c.hardware_catalog.utility_links, 'selectedUtilityLink')] : []),
      ...(stage === 'MCR' ? [toggle('Lidar (slope map)', 'ndl'), toggle('Neutron spectrometer (ice map)', 'neutron_spec_radiometer')] : []),
      info,
    );
    if (!info.textContent) info.textContent = 'Map test page · #map';
  }
  paint();
}
