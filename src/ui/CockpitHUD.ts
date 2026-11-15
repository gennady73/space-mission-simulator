import { GATE_NAMES } from '../engine/StageGateValidators';
import { computeLedger, shadowHoursForMast } from '../engine/SubsystemEngines';
import { PHASES } from '../models/StateStore';
import type { EngineConstants, GateValidationResult, GraphicPlaceholderConfig, Phase, SimulationState, TeamRole } from '../models/Interfaces';
import { renderDebrief, renderGateBanner, type Debrief, type DebriefActions } from './DebriefView';
import { PHASE_CHOICES, provisionalDesign } from './DesignFlow';
import { h, kg, pct, usdM } from './dom';
import { closePopover, togglePopover } from './popover';
import { renderSideQuests } from './SideQuestModal';
import { renderPreStageQuestion, type PreStageActions } from './PreStageQuestion';
import { renderReviewModal, type ReviewActions, type ReviewOutcome } from './ReviewModal';

/** Life-cycle phase that each review closes (NPR 7120.5 naming). */
const PHASE_PREFIX: Record<Phase, string> = { MCR: 'Pre-Phase A', SRR: 'Phase A', PDR: 'Phase B', CDR: 'Phase C', PLAR: 'Phase D/E' };
export const phaseTitle = (p: Phase): string => `${PHASE_PREFIX[p]}: ${GATE_NAMES[p]}`;
/** The title as DOM: the bracketed NASA acronym gets its own span so Media can colour it (D-302). textContent is unchanged. */
const phaseTitleNodes = (p: Phase): (string | HTMLElement)[] => {
  const m = /^(.*?)(\([A-Z]+\))$/.exec(phaseTitle(p));
  return m ? [m[1], h('span', { class: 'nasa-term' }, m[2])] : [phaseTitle(p)];
};

export interface CockpitView {
  constants: EngineConstants;
  state: SimulationState;
  banner: GateValidationResult | null;
  /** One-line orientation shown under the stage title (where you came from, what to do now). */
  notice: string | null;
  /** Verdict of the last submission, shown as a modal until the player answers it. */
  review: ReviewOutcome | null;
  padDistanceDraft: string;
  heaterDraft: string;
  debrief: Debrief | null;
  /** Persistent console viewport owned by main.ts: the site map, or the flight playback. */
  viewport: HTMLElement;
}

export interface CockpitActions extends DebriefActions, PreStageActions, ReviewActions {
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
type Child = Node | string | null | undefined | false;

/** Small "i" button: the details open in a popover on demand. Always enabled, because reading is never locked (D-303). */
function infoButton(name: string, build: () => Child[]): HTMLElement {
  const button = h('button', { type: 'button', class: 'info-btn', 'aria-label': `More about ${name}`, 'aria-expanded': 'false', 'aria-haspopup': 'dialog' }, 'i');
  button.addEventListener('click', () => togglePopover(button, `About ${name}`, build));
  return button;
}

/**
 * Narrative briefing as one line (D-303): badge and title from the placeholder config, the text in a popover.
 * Keeps the REQ-011 hooks ([data-placeholder-id], .fallback-frame .fallback-badge); the END card is unchanged.
 */
function briefingLine(cfg: GraphicPlaceholderConfig): HTMLElement {
  const info = infoButton(cfg.title, () => [h('strong', {}, cfg.title), h('p', {}, cfg.brief_explanation)]);
  return h('figure', { class: 'placeholder placeholder--line', 'data-placeholder-id': cfg.id },
    h('div', { class: 'fallback-frame' }, h('span', { class: 'fallback-badge' }, cfg.fallback_badge), h('h3', {}, cfg.title), info));
}

/** Which decision group is open: presentation only, one per stage, recomputed when the stage changes (D-303). */
let openGroup: { phase: Phase; category: string | null } | null = null;
/** Category just picked in a single-choice group: the next render opens the next group that still needs a choice. */
let advanceFrom: string | null = null;
/** Element to focus after the next render: the header of a group that was just opened, for keyboard players. */
let pendingFocusId: string | null = null;

interface Group { category: string; title: string; selected: string | string[] | null; build: (open: boolean) => HTMLElement }
const hasChoice = (g: Group): boolean => (Array.isArray(g.selected) ? g.selected.length > 0 : g.selected !== null);

/**
 * One decision group open at a time (D-303). When a stage opens, the first group without a choice is open
 * (all collapsed when every group has one). After a pick, the next group after it that still needs a choice
 * opens, else the next one in order; a multi-choice group stays open. Nothing here touches the state.
 */
function renderGroups(phase: Phase, groups: Group[]): HTMLElement[] {
  if (!openGroup || openGroup.phase !== phase) {
    openGroup = { phase, category: groups.find((g) => !hasChoice(g))?.category ?? null };
  } else if (advanceFrom) {
    const after = groups.slice(groups.findIndex((g) => g.category === advanceFrom) + 1);
    const next = after.find((g) => !hasChoice(g)) ?? after[0];
    if (next) { openGroup = { phase, category: next.category }; pendingFocusId = `group-${next.category}`; }
  }
  advanceFrom = null;
  return groups.map((g) => g.build(openGroup?.category === g.category));
}

function group<T extends Entry>(
  title: string, category: string, table: Record<string, T>, selected: string | string[] | null,
  detail: (item: T) => string, onPick: (id: string) => void, lock: string | null = null,
): Group {
  return { category, title, selected, build: (open) => choices(title, category, table, selected, detail, onPick, lock, open) };
}

/**
 * One option = one row (D-303): the name on one line, and an "i" button whose popover holds the name,
 * the stats line and the description. Two sibling buttons in a row wrapper, never a button in a button.
 * The select button keeps its id `btn-<category>-<id>`, its handler and aria-pressed (the e2e contract).
 * The group is collapsible: its header is a button with aria-expanded; the header always works, even when
 * the seat is locked, because reading is always allowed. Collapsed rows stay in the DOM, hidden.
 */
function choices<T extends Entry>(
  title: string, category: string, table: Record<string, T>, selected: string | string[] | null,
  detail: (item: T) => string, onPick: (id: string) => void, lock: string | null, open: boolean,
): HTMLElement {
  const multi = Array.isArray(selected);
  const picked = (id: string) => (Array.isArray(selected) ? selected.includes(id) : selected === id);
  const items = Object.values(table);
  const chosen = items.filter((i) => picked(i.id)).map((i) => i.name);
  const headId = `group-${category}`;
  const bodyId = `group-${category}-body`;
  const head = h('button', { type: 'button', id: headId, class: 'group-head', 'aria-expanded': String(open), 'aria-controls': bodyId },
    h('span', { class: 'group-title' }, lock ? `${title} · decided by ${lock}` : title),
    h('span', { class: chosen.length ? 'group-choice' : 'group-choice group-choice--none' }, chosen.length ? chosen.join(', ') : 'not chosen'),
    h('span', { class: 'group-chevron', 'aria-hidden': 'true' }));
  const body = h('div', { id: bodyId, class: 'choices', ...(open ? {} : { hidden: '' }) });
  for (const item of items) {
    const select = h('button', { id: `btn-${category}-${item.id}`, type: 'button', class: 'choice', 'aria-pressed': String(picked(item.id)), ...(lock ? { disabled: '' } : {}) },
      h('span', { class: 'choice-name' }, item.name));
    select.addEventListener('click', () => { if (!multi) advanceFrom = category; onPick(item.id); });
    const info = infoButton(item.name, () => [h('strong', {}, item.name), h('span', { class: 'stats' }, detail(item)), item.description && h('p', {}, item.description)]);
    body.append(h('div', { class: 'choice-row' }, select, info));
  }
  const section = h('section', { class: `choice-group choice-group--collapsible${lock ? ' locked' : ''}`, role: 'group', 'aria-labelledby': headId }, head, body);
  head.addEventListener('click', () => {
    const willOpen = head.getAttribute('aria-expanded') !== 'true';
    for (const g of document.querySelectorAll<HTMLElement>('.console-panel .choice-group--collapsible')) {
      const on = willOpen && g === section;
      g.querySelector('.group-head')?.setAttribute('aria-expanded', String(on));
      const rows = g.querySelector<HTMLElement>('.choices');
      if (rows) rows.hidden = !on;
    }
    if (openGroup) openGroup = { ...openGroup, category: willOpen ? category : null };
  });
  return section;
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
export function lockFor(c: EngineConstants, s: SimulationState, decision: string): string | null {
  if (!s.teamMode) return null;
  const owner = Object.entries(c.team_roles).find(([, role]) => role.decides.includes(decision));
  return owner && owner[0] !== s.activeRole ? owner[1].label : null;
}

type Site = EngineConstants['site_catalog'][string];
const siteStats = (x: Site): string =>
  `Slope ${x.slope_deg}° · Earth in view ${pct(x.earth_visibility_fraction)} of the time · sunlit ${pct(x.illumination_fraction)} · cold trap ${x.distance_to_cold_trap_km} km away`;

/**
 * Landing site (D-303): the player picks it on the map; the panel shows one card. The list under the card
 * is the keyboard-operable equivalent of the pins (the map is a canvas, so its pins cannot take focus).
 * Hooks: #site-card, #select-site, #btn-site-clear. All site text comes from c.site_catalog.
 */
function siteCard(c: EngineConstants, s: SimulationState, a: CockpitActions, lock: string | null): HTMLElement {
  const site = s.selectedSite ? c.site_catalog[s.selectedSite] : undefined;
  const list = h('select', { id: 'select-site', 'aria-label': 'Choose a landing site from the list', ...(lock ? { disabled: '' } : {}) },
    h('option', { value: '' }, 'Choose from the list…'),
    ...Object.values(c.site_catalog).map((x) => h('option', { value: x.id, ...(x.id === s.selectedSite ? { selected: '' } : {}) }, x.name)));
  list.addEventListener('change', () => a.update({ selectedSite: list.value || null }));
  const card = h('div', { id: 'site-card', class: site ? 'site-card' : 'site-card site-card--empty' });
  if (site) {
    const clear = h('button', { id: 'btn-site-clear', type: 'button', class: 'linklike', ...(lock ? { disabled: '' } : {}) }, 'Clear');
    clear.addEventListener('click', () => a.update({ selectedSite: null }));
    card.append(
      h('strong', { class: 'site-card__name' }, site.name),
      h('span', { class: 'site-card__stats' }, siteStats(site)),
      site.description && h('p', { class: 'site-card__why' }, site.description),
      h('p', { class: 'hint' }, 'Tap another site on the map to change it.'),
      h('div', { class: 'site-card__actions' }, list, clear));
  } else {
    card.append(h('p', { class: 'site-card__empty' }, 'No site chosen yet. Tap a site on the map.'), h('div', { class: 'site-card__actions' }, list));
  }
  return h('fieldset', { class: lock ? 'choice-group locked' : 'choice-group' }, h('legend', {}, lock ? `Landing site · decided by ${lock}` : 'Landing site'), card);
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
      siteCard(c, s, a, lock('landing site')),
    );
  } else if (s.currentPhase === 'SRR') {
    box.append(
      ...renderGroups('SRR', [
        group('Launch vehicle', 'lv', hw.launch_vehicles, s.selectedLaunchVehicle,
          (x) => `${kg(x.tli_capacity_kg)} to the Moon · ${x.fairing_diameter_m} m fairing · ${usdM(x.cost_usd)}`,
          (id) => a.update({ selectedLaunchVehicle: id }), lock('launch vehicle')),
        group('Transfer trajectory', 'trajectory', c.trajectories, s.selectedTrajectory,
          (x) => `${x.cruise_days} days of cruise · landing needs ${x.descent_delta_v_m_s} m/s · ${usdM(x.extra_cost_usd)} extra`,
          (id) => a.update({ selectedTrajectory: id }), lock('trajectory')),
        group('Landing pad', 'pad', hw.launchpads, s.selectedLaunchpad,
          (x) => `${kg(x.mass_kg)} · ${usdM(x.cost_usd)} · must stand at least ${x.requires_standoff_distance_m} m from the solar mast`,
          (id) => a.update({ selectedLaunchpad: id }), lock('landing pad')),
      ]),
      numberField('input-pad-distance', 'Distance from pad to solar mast (m)', view.padDistanceDraft, '50', (v) => {
        a.setPadDistanceDraft(v);
        const line = document.getElementById('objective-padDistanceM');
        if (line) { line.dataset.done = String(isNumber(v)); line.textContent = objectiveText('pad standoff distance', isNumber(v)); }
      }, lock('pad standoff distance')),
    );
  } else if (s.currentPhase === 'PDR') {
    const site = s.selectedSite ? c.site_catalog[s.selectedSite] : undefined;
    box.append(...renderGroups('PDR', [
      group('Power mast', 'mast', hw.power_masts, s.selectedMast,
        (x) => `${x.rated_power_w.toLocaleString('en-US')} W in sunlight · works when the Sun is above ${x.cutoff_elevation_deg}°${site ? ` · longest shadow here ${formatShadow(shadowHoursForMast(c, site, x))}` : ''} · ${kg(x.mass_kg)} · ${usdM(x.cost_usd)}`,
        (id) => a.update({ selectedMast: id }), lock('power mast')),
      group('Energy storage', 'battery', hw.energy_storage, s.selectedBattery,
        (x) => `${x.capacity_kwh} kWh, ${pct(x.max_dod)} usable · ${kg(x.mass_kg)} · ${usdM(x.cost_usd)}`,
        (id) => a.update({ selectedBattery: id }), lock('battery')),
      group('Communications', 'comm', hw.comm_systems, s.selectedComm,
        (x) => `${x.downlink_kbps.toLocaleString('en-US')} kbps · ${x.direct_to_earth ? 'needs Earth above the horizon' : `relay in view ${pct(x.relay_coverage_fraction ?? 0)} of the time`} · ${x.tx_power_w} W · ${kg(x.mass_kg)} · ${usdM(x.cost_usd)}`,
        (id) => a.update({ selectedComm: id }), lock('communications system')),
      group('Data storage', 'storage', hw.data_storage, s.selectedStorage,
        (x) => `${(x.capacity_mb / 1000).toLocaleString('en-US')} Gbit · ${x.power_w} W · ${kg(x.mass_kg)} · ${usdM(x.cost_usd)}`,
        (id) => a.update({ selectedStorage: id }), lock('data storage')),
      group('Science instruments (choose any)', 'instrument', hw.science_instruments, s.selectedInstruments,
        (x) => `${x.peak_power_w} W peak · ${x.data_rate_kbps} kbps · ${kg(x.mass_kg)} · ${usdM(x.cost_usd)}`,
        (id) => a.update({ selectedInstruments: s.selectedInstruments.includes(id) ? s.selectedInstruments.filter((i) => i !== id) : [...s.selectedInstruments, id] }), lock('science instruments')),
    ]));
  } else if (s.currentPhase === 'CDR') {
    box.append(
      ...renderGroups('CDR', [
        group('Cold-trap logistics', 'logistics', hw.cold_trap_logistics, s.selectedLogistics,
          (x) => `Climbs ${x.max_slope_deg}° · survives the year with ${pct(x.reliability_365d)} probability · heater ${x.survival_heater_w} W · ${kg(x.mass_kg)}${per(x.per_km)} · ${usdM(x.cost_usd)}${per(x.per_km)}`,
          (id) => a.update({ selectedLogistics: id }), lock('cold-trap logistics')),
        group('Power link to the drill', 'link', hw.utility_links, s.selectedUtilityLink,
          (x) => `Delivers ${pct(x.efficiency)} of ${x.source_power_w} W · ${x.max_range_km === null ? 'any distance' : `reaches ${x.max_range_km} km`} · ${pct(x.sever_probability)} chance of a break · ${kg(x.mass_kg)}${per(x.per_km)} · ${usdM(x.cost_usd)}${per(x.per_km)}`,
          (id) => a.update({ selectedUtilityLink: id }), lock('utility link')),
      ]),
      numberField('input-drill-heater', 'Drill survival heater power (W)', view.heaterDraft, '5', a.setHeaterDraft, lock('heater power')),
    );
  }
  return box;
}

const isNumber = (text: string): boolean => Number.isFinite(Number.parseFloat(text));
const objectiveText = (label: string, done: boolean): string => `${done ? '✓' : '○'} Choose the ${label}`;

/** What this stage's review needs, ticked as the player chooses. The typed pad distance is a draft outside the store. */
function objectiveItems(view: CockpitView) {
  const { constants: c, state: s } = view;
  const items = PHASE_CHOICES[s.currentPhase].map(({ key, label }) => ({
    key, label, done: key === 'padDistanceM' ? isNumber(view.padDistanceDraft) : s[key] !== null,
  }));
  const left = items.filter((i) => !i.done).length;
  const { assumed } = provisionalDesign(c, { ...s, padDistanceM: isNumber(view.padDistanceDraft) ? Number.parseFloat(view.padDistanceDraft) : null });
  const later = assumed.filter((label) => !items.some((i) => i.label === label));
  return { items, left, later, status: left ? `${left} still to choose before the review.` : 'Ready for the review.' };
}

/**
 * Objectives checklist (D-034). The "estimated from the reference design" note sits behind an "i" next to
 * the heading, and the status line (#objectives-status) lives beside the submit button (D-303).
 */
function objectives(view: CockpitView): HTMLElement {
  const { items, later } = objectiveItems(view);
  return h('section', { id: 'objectives', class: 'objectives', 'aria-label': 'Objectives for this review' },
    h('div', { class: 'objectives-head' }, h('h3', {}, 'Objectives for this review'),
      later.length > 0 && infoButton('the objectives', () => [h('strong', {}, 'Estimated until you choose'), h('p', {}, `Later stages are estimated from the reference design until you choose: ${later.join(', ')}.`)])),
    h('ul', {}, ...items.map((i) => h('li', { id: `objective-${i.key}`, 'data-done': String(i.done) }, objectiveText(i.label, i.done)))),
  );
}

const formatShadow = (hours: number): string => (!Number.isFinite(hours) ? 'permanent' : hours > 0 ? `${Math.round(hours)} h` : 'none');

/**
 * Comms as a share of what the instruments make, not a raw rate: "sends all the data, 900× headroom"
 * reads as a trade-off, while "2,680,244 Mb per day" did not (UI review 11-15).
 */
function commsCell(
  cell: (name: string, value: string, note: string, ok: boolean) => HTMLElement,
  downlinkMbPerDay: number,
  generatedMbPerDay: number,
): HTMLElement {
  if (generatedMbPerDay <= 0) return cell('Comms', 'nothing to send', 'add an instrument to make data', true);
  const ratio = downlinkMbPerDay / generatedMbPerDay;
  if (ratio >= 1) {
    const headroom = ratio >= 10 ? `${Math.round(ratio).toLocaleString('en-US')}×` : `${ratio.toFixed(1)}×`;
    return cell('Comms', 'sends all the data', `link has ${headroom} the daily data`, true);
  }
  return cell('Comms', `sends ${pct(ratio)} of the data`, 'the rest waits in storage or is lost', false);
}

function resourceBar(view: CockpitView): HTMLElement {
  const { constants: c, state: s } = view;
  const { design } = provisionalDesign(c, s);
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
    commsCell(cell, l.downlinkMbPerDay, l.dataGeneratedMbPerDay),
    cell('Time', `${Math.round(l.missionDurationDays)} days`, 'cruise plus one year of operations', true),
  ));
  return bar;
}

/** Track label per phase: the last stop is the flight itself, with its debrief. */
const TRACK_LABEL: Record<Phase, string> = { MCR: 'MCR', SRR: 'SRR', PDR: 'PDR', CDR: 'CDR', PLAR: 'OPS' };
/** Plain word for what the player decides at each stop; the NASA acronym stays beside it (Lead, play-test 11-15). */
const TRACK_NAME: Record<Phase, string> = { MCR: 'Concept', SRR: 'Landing', PDR: 'Power', CDR: 'Ice', PLAR: 'Operations' };
/** Hover / long-press hint: what the review is, in one sentence. Wording belongs to Media. */
const TRACK_HINT: Record<Phase, string> = {
  MCR: 'Mission Concept Review (MCR): is the idea sound? Choose the goal and the landing site.',
  SRR: 'System Requirements Review (SRR): can it get there and land safely? Choose the rocket, the route and the landing pad.',
  PDR: 'Preliminary Design Review (PDR): will it survive the lunar night? Choose power, battery, radio and data storage.',
  CDR: 'Critical Design Review (CDR): can it reach the ice? Choose how to get into the cold trap and how to power the drill.',
  PLAR: 'Operations (OPS): the outpost works for one year on the Moon, then the Post-Launch Assessment Review (PLAR) scores it.',
};

/**
 * Full-screen mission console (D-033): a fixed 100dvh grid with no page scroll.
 * Top bar: title, stage track, six resource tiles, menu. Left: the viewport (map or flight).
 * Right: the stage panel, which scrolls inside itself only.
 */
export function renderCockpit(root: HTMLElement, view: CockpitView, a: CockpitActions): void {
  const { constants: c, state: s } = view;
  const focusId = document.activeElement?.id;
  const panelScroll = root.querySelector('.console-panel')?.scrollTop ?? 0;
  const samePhase = root.querySelector('.console')?.getAttribute('data-phase') === s.currentPhase;
  closePopover(false); // its trigger is about to be replaced
  root.replaceChildren();
  root.classList.add('console-host');

  const flying = s.isSimulationRunning;
  const debriefing = s.currentPhase === 'PLAR' && !!view.debrief;
  view.viewport.classList.toggle('is-flight', flying);

  // ---- top bar ----
  const track = h('ol', { class: 'phase-track' });
  for (const p of PHASES) {
    const reached = PHASES.indexOf(p) <= PHASES.indexOf(s.currentPhase);
    const current = flying ? p === 'PLAR' : p === s.currentPhase;
    const id = `btn-phase-${p === 'PLAR' ? 'FLY' : p}`;
    const button = h('button', { type: 'button', id, 'data-phase': p, title: TRACK_HINT[p], 'aria-label': `${TRACK_NAME[p]} (${TRACK_LABEL[p]})`, ...(reached && !flying ? {} : { disabled: '' }) },
      h('span', { class: 'track-name' }, TRACK_NAME[p]), h('span', { class: 'track-code' }, TRACK_LABEL[p]));
    button.addEventListener('click', () => a.goToPhase(p));
    const item = h('li', { class: [current ? 'current' : '', s.gateResults[p]?.passed ? 'passed' : ''].join(' ').trim() }, button);
    if (current) item.setAttribute('aria-current', 'step');
    track.append(item);
  }

  const difficulty = h('select', { id: 'select-difficulty', 'aria-label': 'Difficulty' },
    ...Object.entries(c.difficulty_levels).map(([id, d]) => h('option', { value: id, ...(id === s.difficulty ? { selected: '' } : {}) }, `${d.label} · ${usdM(d.budget_usd)}`)));
  difficulty.addEventListener('change', () => a.setDifficulty(difficulty.value));
  const teamBox = h('input', { id: 'toggle-team-mode', type: 'checkbox', ...(s.teamMode ? { checked: '' } : {}) });
  teamBox.addEventListener('change', () => a.setTeamMode(teamBox.checked));
  const exportBtn = h('button', { id: 'btn-menu-export', type: 'button', class: 'secondary' }, 'Save design as a file');
  exportBtn.addEventListener('click', a.exportJson);
  const shareBtn = h('button', { id: 'btn-menu-share', type: 'button', class: 'secondary' }, 'Copy share link');
  shareBtn.addEventListener('click', a.copyShareLink);
  const menu = h('details', { class: 'menu' },
    h('summary', { id: 'btn-menu' }, 'Menu'),
    h('div', { class: 'menu-items' },
      h('label', { class: 'toggle' }, teamBox, ' Team play'),
      h('label', { class: 'field' }, 'Difficulty ', difficulty),
      exportBtn, shareBtn,
      h('a', { href: '#about', target: '_blank', rel: 'noopener' }, 'About & numbers')));
  const reference = h('button', { id: 'btn-run-reference', type: 'button', class: 'secondary', ...(flying ? { disabled: '' } : {}) }, 'Reference mission');
  reference.addEventListener('click', a.runReference);

  const top = h('header', { class: 'console-top' },
    h('div', { class: 'console-bar' }, h('h1', {}, 'Lighthouse on the Trail'), track, h('div', { class: 'header-tools' }, reference, menu)),
    resourceBar(view));

  // ---- right: the stage panel ----
  const panel = h('main', { class: 'console-panel' });
  if (!flying && !debriefing) {
    if (s.teamMode) {
      const seats = h('div', { class: 'seats', role: 'group', 'aria-label': 'Whose turn is it' });
      for (const [id, role] of Object.entries(c.team_roles)) {
        const seat = h('button', { id: `btn-role-${id}`, type: 'button', class: 'choice seat', 'aria-pressed': String(id === s.activeRole) },
          h('strong', {}, role.label), h('span', {}, `${role.segment} segment · decides ${role.decides.join(', ')}`), h('span', { class: 'why' }, role.priority_hint));
        seat.addEventListener('click', () => a.setActiveRole(id as TeamRole));
        seats.append(seat);
      }
      panel.append(h('section', { class: 'team' }, h('p', { class: 'hint' }, 'Team play: pass the device to the player whose seat is selected. Each player makes only their own decisions, and all share one budget and one mass limit.'), seats));
    }
    if (s.currentPhase === 'MCR') {
      const intro = c.graphic_placeholders['IMG-PLACEHOLDER-INTRO'];
      if (intro) panel.append(briefingLine(intro));
    }
    const ownerEntry = Object.entries(c.team_roles).find(([, r]) => r.owns_gates.includes(s.currentPhase));
    const owner = ownerEntry?.[1];
    const mustHandOver = s.teamMode && ownerEntry !== undefined && ownerEntry[0] !== s.activeRole;
    panel.append(h('h2', { id: 'current-phase-display', class: 'phase-title' }, ...phaseTitleNodes(s.currentPhase)));
    if (owner && s.teamMode) panel.append(h('p', { class: 'hint' }, `Review owner: ${owner.label}. ${owner.priority_hint}`));
    if (view.notice) panel.append(h('p', { id: 'console-notice', class: 'console-notice' }, view.notice));
    if (view.banner) panel.append(renderGateBanner(view.banner));
    panel.append(renderPreStageQuestion(c, s, a));

    if (!debriefing) {
      panel.append(objectives(view), phasePanel(view, a));
      // Lead: optional side-quests for this phase (REQ-008, D-101).
      const quests = renderSideQuests(c, s.currentPhase, s.completedQuests, c.difficulty_levels[s.difficulty].hints_enabled,
        (id) => a.update({ completedQuests: [...s.completedQuests, id] }));
      if (quests) panel.append(quests);
      const verb = s.currentPhase === 'CDR' ? 'Submit to review and launch' : 'Submit to review';
      const next = h('button', { id: 'btn-next-phase', type: 'button', ...(mustHandOver ? { disabled: '' } : {}) },
        s.teamMode && owner ? `${verb}: sign-off by ${owner.label}` : verb);
      next.addEventListener('click', a.nextPhase);
      // The submit bar stays pinned at the bottom of the panel, with the status line beside the button (D-303).
      panel.append(h('div', { class: 'panel-submit' },
        mustHandOver && owner && h('p', { id: 'signoff-note', class: 'hint' }, `Only ${owner.label} can sign off this review. Select that seat to submit.`),
        h('div', { class: 'submit-row' }, h('p', { id: 'objectives-status', class: 'hint' }, objectiveItems(view).status), next)));
    }
  }

  // ---- grid ----
  const mode = flying ? 'flight' : debriefing ? 'debrief' : 'design';
  const grid = h('div', { class: `console console--${mode}`, 'data-phase': s.currentPhase }, top);
  if (mode !== 'debrief') grid.append(h('div', { class: 'console-view' }, view.viewport));
  if (mode === 'design') grid.append(panel);
  root.append(grid);
  // Debrief (D-036): a full-viewport overlay over the console; "Revise design" goes back to CDR.
  if (debriefing && view.debrief) {
    root.append(h('div', { id: 'debrief-overlay', class: 'debrief-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'current-phase-display' },
      h('h2', { id: 'current-phase-display', class: 'phase-title' }, ...phaseTitleNodes(s.currentPhase)),
      renderDebrief(c, view.debrief, a),
      renderPreStageQuestion(c, s, a)));
  }
  if (view.review && mode === 'design') root.append(renderReviewModal(view.review, a));
  // A choice re-renders the panel: keep the player's place in it. A new stage starts at its top.
  if (samePhase) panel.scrollTop = panelScroll;
  if (focusId && !view.review) document.getElementById(focusId)?.focus({ preventScroll: true });
  // A pick collapsed its group: keep a keyboard player on the group that just opened (D-303).
  if (pendingFocusId) { document.getElementById(pendingFocusId)?.focus({ preventScroll: true }); pendingFocusId = null; }
}
