import { GATE_NAMES } from '../engine/StageGateValidators';
import { computeLedger, shadowHoursForMast } from '../engine/SubsystemEngines';
import { PHASES } from '../models/StateStore';
import type { EngineConstants, GateValidationResult, Phase, SimulationState, TeamRole } from '../models/Interfaces';
import { renderDebrief, renderGateBanner, type Debrief, type DebriefActions } from './DebriefView';
import { provisionalDesign } from './DesignFlow';
import { h, kg, pct, usdM } from './dom';
import { renderPlaceholder } from './GraphicPlaceholderView';
import { renderPreStageQuestion, type PreStageActions } from './PreStageQuestion';

/** Life-cycle phase that each review closes (NPR 7120.5 naming). */
const PHASE_PREFIX: Record<Phase, string> = { MCR: 'Pre-Phase A', SRR: 'Phase A', PDR: 'Phase B', CDR: 'Phase C', PLAR: 'Phase D/E' };
export const phaseTitle = (p: Phase): string => `${PHASE_PREFIX[p]}: ${GATE_NAMES[p]}`;

export interface CockpitView {
  constants: EngineConstants;
  state: SimulationState;
  banner: GateValidationResult | null;
  padDistanceDraft: string;
  heaterDraft: string;
  debrief: Debrief | null;
}

export interface CockpitActions extends DebriefActions, PreStageActions {
  update(patch: Partial<SimulationState>): void;
  setPadDistanceDraft(value: string): void;
  setHeaterDraft(value: string): void;
  setDifficulty(id: string): void;
  setTeamMode(on: boolean): void;
  setActiveRole(role: TeamRole): void;
  nextPhase(): void;
  goToPhase(phase: Phase): void;
  runReference(): void;
}

interface Entry { id: string; name: string; description?: string }

function choices<T extends Entry>(
  title: string, category: string, table: Record<string, T>, selected: string | string[] | null,
  detail: (item: T) => string, onPick: (id: string) => void, lock: string | null = null,
): HTMLElement {
  const picked = (id: string) => (Array.isArray(selected) ? selected.includes(id) : selected === id);
  const grid = h('div', { class: 'choices' });
  for (const item of Object.values(table)) {
    const button = h('button', { id: `btn-${category}-${item.id}`, type: 'button', class: 'choice', 'aria-pressed': String(picked(item.id)), ...(lock ? { disabled: '' } : {}) },
      h('strong', {}, item.name), h('span', {}, detail(item)), item.description && h('span', { class: 'why' }, item.description));
    button.addEventListener('click', () => onPick(item.id));
    grid.append(button);
  }
  return h('fieldset', { class: lock ? 'choice-group locked' : 'choice-group' }, h('legend', {}, lock ? `${title} · decided by ${lock}` : title), grid);
}

function numberField(id: string, label: string, value: string, step: string, onInput: (v: string) => void, lock: string | null = null): HTMLElement {
  const input = h('input', { id, type: 'number', min: '0', step, value, ...(lock ? { disabled: '' } : {}) });
  if (lock) label = `${label} · decided by ${lock}`;
  input.addEventListener('input', () => onInput(input.value));
  return h('label', { class: 'field' }, `${label} `, input);
}

/**
 * Team play (D-010): each decision belongs to one seat, named in team_roles[*].decides.
 * Returns the owning seat's label when the active seat may not make this decision, else null.
 */
function lockFor(c: EngineConstants, s: SimulationState, decision: string): string | null {
  if (!s.teamMode) return null;
  const owner = Object.entries(c.team_roles).find(([, role]) => role.decides.includes(decision));
  return owner && owner[0] !== s.activeRole ? owner[1].label : null;
}

function phasePanel(view: CockpitView, a: CockpitActions): HTMLElement {
  const { constants: c, state: s } = view;
  const lock = (decision: string) => lockFor(c, s, decision);
  const hw = c.hardware_catalog;
  const box = h('section', { class: 'panel' });
  const per = (flag: boolean) => (flag ? ' per km' : '');

  if (s.currentPhase === 'MCR') {
    const objective = h('input', { id: 'input-objective', type: 'text', value: s.missionObjective ?? '', placeholder: 'For example: assay 1,000 kg of polar water ice in one year', ...(lock('mission objective') ? { disabled: '' } : {}) });
    objective.addEventListener('change', () => a.update({ missionObjective: objective.value || null }));
    box.append(
      h('label', { class: 'field wide' }, 'Mission objective: what must this outpost achieve? ', objective),
      choices('Landing site', 'site', c.site_catalog, s.selectedSite,
        (x) => `Slope ${x.slope_deg}° · Earth in view ${pct(x.earth_visibility_fraction)} of the time · sunlit ${pct(x.illumination_fraction)} · cold trap ${x.distance_to_cold_trap_km} km away`,
        (id) => a.update({ selectedSite: id }), lock('landing site')),
    );
  } else if (s.currentPhase === 'SRR') {
    box.append(
      choices('Launch vehicle', 'lv', hw.launch_vehicles, s.selectedLaunchVehicle,
        (x) => `${kg(x.tli_capacity_kg)} to the Moon · ${x.fairing_diameter_m} m fairing · ${usdM(x.cost_usd)}`,
        (id) => a.update({ selectedLaunchVehicle: id }), lock('launch vehicle')),
      choices('Transfer trajectory', 'trajectory', c.trajectories, s.selectedTrajectory,
        (x) => `${x.cruise_days} days of cruise · landing needs ${x.descent_delta_v_m_s} m/s · ${usdM(x.extra_cost_usd)} extra`,
        (id) => a.update({ selectedTrajectory: id }), lock('trajectory')),
      choices('Landing pad', 'pad', hw.launchpads, s.selectedLaunchpad,
        (x) => `${kg(x.mass_kg)} · ${usdM(x.cost_usd)} · must stand at least ${x.requires_standoff_distance_m} m from the solar mast`,
        (id) => a.update({ selectedLaunchpad: id }), lock('landing pad')),
      numberField('input-pad-distance', 'Distance from pad to solar mast (m)', view.padDistanceDraft, '50', a.setPadDistanceDraft, lock('pad standoff distance')),
    );
  } else if (s.currentPhase === 'PDR') {
    const site = s.selectedSite ? c.site_catalog[s.selectedSite] : undefined;
    box.append(
      choices('Power mast', 'mast', hw.power_masts, s.selectedMast,
        (x) => `${x.rated_power_w.toLocaleString('en-US')} W in sunlight · works when the Sun is above ${x.cutoff_elevation_deg}°${site ? ` · longest shadow here ${formatShadow(shadowHoursForMast(c, site, x))}` : ''} · ${kg(x.mass_kg)} · ${usdM(x.cost_usd)}`,
        (id) => a.update({ selectedMast: id }), lock('power mast')),
      choices('Energy storage', 'battery', hw.energy_storage, s.selectedBattery,
        (x) => `${x.capacity_kwh} kWh, ${pct(x.max_dod)} usable · ${kg(x.mass_kg)} · ${usdM(x.cost_usd)}`,
        (id) => a.update({ selectedBattery: id }), lock('battery')),
      choices('Communications', 'comm', hw.comm_systems, s.selectedComm,
        (x) => `${x.downlink_kbps.toLocaleString('en-US')} kbps · ${x.direct_to_earth ? 'needs Earth above the horizon' : `relay in view ${pct(x.relay_coverage_fraction ?? 0)} of the time`} · ${x.tx_power_w} W · ${kg(x.mass_kg)} · ${usdM(x.cost_usd)}`,
        (id) => a.update({ selectedComm: id }), lock('communications system')),
      choices('Data storage', 'storage', hw.data_storage, s.selectedStorage,
        (x) => `${(x.capacity_mb / 1000).toLocaleString('en-US')} Gbit · ${x.power_w} W · ${kg(x.mass_kg)} · ${usdM(x.cost_usd)}`,
        (id) => a.update({ selectedStorage: id }), lock('data storage')),
      choices('Science instruments (choose any)', 'instrument', hw.science_instruments, s.selectedInstruments,
        (x) => `${x.peak_power_w} W peak · ${x.data_rate_kbps} kbps · ${kg(x.mass_kg)} · ${usdM(x.cost_usd)}`,
        (id) => a.update({ selectedInstruments: s.selectedInstruments.includes(id) ? s.selectedInstruments.filter((i) => i !== id) : [...s.selectedInstruments, id] }), lock('science instruments')),
    );
  } else if (s.currentPhase === 'CDR') {
    box.append(
      choices('Cold-trap logistics', 'logistics', hw.cold_trap_logistics, s.selectedLogistics,
        (x) => `Climbs ${x.max_slope_deg}° · survives the year with ${pct(x.reliability_365d)} probability · heater ${x.survival_heater_w} W · ${kg(x.mass_kg)}${per(x.per_km)} · ${usdM(x.cost_usd)}${per(x.per_km)}`,
        (id) => a.update({ selectedLogistics: id }), lock('cold-trap logistics')),
      choices('Power link to the drill', 'link', hw.utility_links, s.selectedUtilityLink,
        (x) => `Delivers ${pct(x.efficiency)} of ${x.source_power_w} W · ${x.max_range_km === null ? 'any distance' : `reaches ${x.max_range_km} km`} · ${pct(x.sever_probability)} chance of a break · ${kg(x.mass_kg)}${per(x.per_km)} · ${usdM(x.cost_usd)}${per(x.per_km)}`,
        (id) => a.update({ selectedUtilityLink: id }), lock('utility link')),
      numberField('input-drill-heater', 'Drill survival heater power (W)', view.heaterDraft, '5', a.setHeaterDraft, lock('heater power')),
    );
  }
  return box;
}

const formatShadow = (hours: number): string => (!Number.isFinite(hours) ? 'permanent' : hours > 0 ? `${Math.round(hours)} h` : 'none');

function resourceBar(view: CockpitView): HTMLElement {
  const { constants: c, state: s } = view;
  const { design, assumed } = provisionalDesign(c, s);
  const bar = h('section', { class: 'resources', 'aria-label': 'Mission resources' });
  if (!design) return bar;
  const l = computeLedger(c, design, s.allocatedBudgetUSD);
  const minMargin = c.system_constants.minimum_power_margin_pdr;
  const cell = (name: string, value: string, note: string, ok: boolean) =>
    h('div', { class: ok ? 'resource' : 'resource bad' }, h('dt', {}, name), h('dd', {}, value), h('small', {}, `${ok ? '' : 'Problem: '}${note}`));
  bar.append(h('dl', {},
    cell('Mass', `${kg(l.wetMassKg)} of ${kg(l.launchCapacityKg)}`, `${pct(l.massMarginFraction)} spare on the launcher`, l.massMarginFraction >= 0),
    cell('Power', `${pct(l.powerMarginFraction)} shadow margin`, `review needs ${pct(minMargin)}`, l.powerMarginFraction >= minMargin),
    cell('Budget', `${usdM(l.totalCostUSD)} of ${usdM(l.budgetUSD)}`, `${usdM(l.budgetUSD - l.totalCostUSD)} left`, l.totalCostUSD <= l.budgetUSD),
    cell('Data', `${Math.round(l.dataGeneratedMbPerDay).toLocaleString('en-US')} Mb per day`, 'made by the instruments', true),
    cell('Comms', `${Math.round(l.downlinkMbPerDay).toLocaleString('en-US')} Mb per day`, 'can be sent home on average', l.downlinkMbPerDay >= l.dataGeneratedMbPerDay),
    cell('Time', `${Math.round(l.missionDurationDays)} days`, 'cruise plus one year of operations', true),
  ));
  if (assumed.length) bar.append(h('p', { class: 'hint' }, `Estimate. Not chosen yet, so the reference design's choice is assumed for: ${assumed.join(', ')}.`));
  return bar;
}

export function renderCockpit(root: HTMLElement, view: CockpitView, a: CockpitActions): void {
  const { constants: c, state: s } = view;
  const focusId = document.activeElement?.id;
  root.replaceChildren();

  const difficulty = h('select', { id: 'select-difficulty', 'aria-label': 'Difficulty' },
    ...Object.entries(c.difficulty_levels).map(([id, d]) => h('option', { value: id, ...(id === s.difficulty ? { selected: '' } : {}) }, `${d.label} · ${usdM(d.budget_usd)}`)));
  difficulty.addEventListener('change', () => a.setDifficulty(difficulty.value));
  const teamBox = h('input', { id: 'toggle-team-mode', type: 'checkbox', ...(s.teamMode ? { checked: '' } : {}) });
  teamBox.addEventListener('change', () => a.setTeamMode(teamBox.checked));
  const team = h('label', { class: 'toggle' }, teamBox, ' Team play');
  const reference = h('button', { id: 'btn-run-reference', type: 'button', class: 'secondary' }, 'Fly the reference mission');
  reference.addEventListener('click', a.runReference);

  const track = h('ol', { class: 'phase-track' });
  for (const p of PHASES) {
    const reached = PHASES.indexOf(p) <= PHASES.indexOf(s.currentPhase);
    const button = h('button', { type: 'button', id: `btn-phase-${p}`, 'data-phase': p, ...(reached ? {} : { disabled: '' }) }, p);
    button.addEventListener('click', () => a.goToPhase(p));
    const item = h('li', { class: [p === s.currentPhase ? 'current' : '', s.gateResults[p]?.passed ? 'passed' : ''].join(' ').trim() }, button);
    if (p === s.currentPhase) item.setAttribute('aria-current', 'step');
    track.append(item);
  }
  root.append(h('header', { class: 'cockpit-header' }, h('h1', {}, 'Polar Outpost Pioneer'), track, h('div', { class: 'header-tools' }, team, difficulty, reference)));
  if (s.teamMode) {
    const seats = h('div', { class: 'seats', role: 'group', 'aria-label': 'Whose turn is it' });
    for (const [id, role] of Object.entries(c.team_roles)) {
      const seat = h('button', { id: `btn-role-${id}`, type: 'button', class: 'choice seat', 'aria-pressed': String(id === s.activeRole) },
        h('strong', {}, role.label), h('span', {}, `${role.segment} segment · decides ${role.decides.join(', ')}`), h('span', { class: 'why' }, role.priority_hint));
      seat.addEventListener('click', () => a.setActiveRole(id as TeamRole));
      seats.append(seat);
    }
    root.append(h('section', { class: 'team' }, h('p', { class: 'hint' }, 'Team play: pass the device to the player whose seat is selected. Each player makes only their own decisions, and all share one budget and one mass limit.'), seats));
  }
  root.append(resourceBar(view));

  const main = h('main', { class: 'cockpit-main' });
  if (s.currentPhase === 'MCR' && !s.selectedSite) {
    const intro = renderPlaceholder(c, 'IMG-PLACEHOLDER-INTRO');
    if (intro) main.append(intro);
  }
  // The debrief has its own hero card, so the PLAR stage banner is not stacked on top of it.
  const stage = s.currentPhase === 'PLAR' && view.debrief ? undefined : Object.values(c.graphic_placeholders).find((p) => p.target_stage === s.currentPhase);
  const stageCard = stage ? renderPlaceholder(c, stage.id) : null;
  if (stageCard) main.append(stageCard);

  const ownerEntry = Object.entries(c.team_roles).find(([, r]) => r.owns_gates.includes(s.currentPhase));
  const owner = ownerEntry?.[1];
  const mustHandOver = s.teamMode && ownerEntry !== undefined && ownerEntry[0] !== s.activeRole;
  main.append(h('h2', { id: 'current-phase-display', class: 'phase-title' }, phaseTitle(s.currentPhase)));
  if (owner) main.append(h('p', { class: 'hint' }, `Review owner in team play: ${owner.label}. ${owner.priority_hint}`));
  if (view.banner) main.append(renderGateBanner(view.banner));
  main.append(renderPreStageQuestion(c, s, a));

  if (s.currentPhase === 'PLAR' && view.debrief) {
    main.append(renderDebrief(c, view.debrief, a));
  } else {
    main.append(phasePanel(view, a));
    const verb = s.currentPhase === 'CDR' ? 'Submit to review and launch' : 'Submit to review';
    const next = h('button', { id: 'btn-next-phase', type: 'button', ...(mustHandOver ? { disabled: '' } : {}) },
      s.teamMode && owner ? `${verb}: sign-off by ${owner.label}` : verb);
    next.addEventListener('click', a.nextPhase);
    main.append(next);
    if (mustHandOver && owner) main.append(h('p', { id: 'signoff-note', class: 'hint' }, `Only ${owner.label} can sign off this review. Select that seat to submit.`));
  }
  root.append(main);
  if (focusId) document.getElementById(focusId)?.focus();
}
