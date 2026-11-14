import type { SimulationResult } from '../engine/SimulationClock';
import type { EngineConstants, GateValidationResult, MissionScore, Phase } from '../models/Interfaces';
import { h, usdM } from './dom';
import { renderPlaceholder } from './GraphicPlaceholderView';
import { renderStripChart } from './TelemetryStripCharts';
import { DESIGN_PHASES } from './DesignFlow';

export interface Debrief {
  result: SimulationResult;
  score: MissionScore;
  plar: GateValidationResult;
  gates: Partial<Record<Phase, GateValidationResult>>;
  costUSD: number;
  budgetUSD: number;
}

export interface DebriefActions {
  revise(): void;
  exportJson(): void;
  copyShareLink(): void;
}

export function renderGateBanner(g: GateValidationResult): HTMLElement {
  return h('div', { class: g.passed ? 'gate-pass-banner' : 'gate-error-banner', role: g.passed ? 'status' : 'alert' },
    h('strong', {}, g.passed ? `${g.gateName}: passed` : `${g.gateName}: not passed`),
    h('p', {}, g.diagnosticExplanation),
    !g.passed && h('p', {}, `What to change: ${g.remediationAction}`),
    h('small', {}, `${g.governingStandard} · ${g.reasonCode}`),
  );
}

/** One line per step from the first review to the end of the flight year. */
function faultTree(d: Debrief): HTMLElement {
  const steps = DESIGN_PHASES.map((p) => `${p} ${d.gates[p]?.passed ? 'passed' : 'failed'}`);
  const r = d.result;
  if (r.failureCause === 'BROWNOUT') steps.push(`battery empty on day ${Math.floor((r.failureHour ?? 0) / 24)}`, 'heaters off', 'loss of signal');
  else if (r.failureCause) steps.push(`${r.failureCause.toLowerCase().replace('_', ' ')} on day ${Math.floor((r.failureHour ?? 0) / 24)}`);
  else steps.push(`operated all ${r.uptimeHours} hours`);
  steps.push(d.plar.passed ? 'PLAR passed' : 'PLAR failed');
  return h('ol', { class: 'fault-tree' }, ...steps.map((s) => h('li', { class: /failed|empty|off|loss/.test(s) ? 'bad' : '' }, s)));
}

/**
 * Debrief (D-036): shown as a full-viewport overlay after the flight. Left column: the verdict,
 * score, what happened and the badges. Right column: the flight year as strip charts, with a
 * marker at the hour the outpost was lost when the mission failed.
 */
export function renderDebrief(c: EngineConstants, d: Debrief, actions: DebriefActions): HTMLElement {
  const { result: r, score } = d;
  const hours = c.simulation.mission_duration_h;
  const box = h('section', { class: 'debrief' });

  const revise = h('button', { id: 'btn-revise-design', type: 'button' }, 'Revise design');
  revise.addEventListener('click', actions.revise);
  const exportBtn = h('button', { id: 'btn-export-design', type: 'button', class: 'secondary' }, 'Save design as a file');
  exportBtn.addEventListener('click', actions.exportJson);
  const share = h('button', { id: 'btn-share-design', type: 'button', class: 'secondary' }, 'Copy share link');
  share.addEventListener('click', actions.copyShareLink);

  const tile = (label: string, value: string) => h('div', { class: 'tile' }, h('dt', {}, label), h('dd', {}, value));
  const summary = h('div', { class: 'debrief-col' },
    h('div', { class: 'debrief-score', id: 'debrief-score' },
      h('span', {}, 'Mission score (game rule)'), h('strong', {}, String(score.total)), h('span', {}, 'of 1000')),
    renderGateBanner(d.plar),
    h('div', { class: 'actions' }, revise, exportBtn, share),
    h('dl', { class: 'tiles' },
      tile('Reviews passed', `${score.gatesPassed} of 5`),
      tile('Water ice assayed', `${Math.round(r.iceKg).toLocaleString('en-US')} kg`),
      tile('Operating time', `${r.uptimeHours} of ${hours} h`),
      tile('Science data delivered', `${(score.dataCompleteness * 100).toFixed(0)}%`),
      tile('Lowest battery charge', `${r.minSoCPercent.toFixed(0)}%`),
      tile('Cost against budget', `${usdM(d.costUSD)} of ${usdM(d.budgetUSD)}`),
    ),
    h('h3', {}, 'What happened, in order'),
    faultTree(d),
  );
  if (score.badges.length) {
    summary.append(
      h('h3', {}, 'NASA technology shortfalls this design addressed'),
      h('ul', { class: 'badges', id: 'debrief-badges' }, ...score.badges.map((id) => h('li', {}, h('strong', {}, id), ` ${c.shortfall_badges[id]?.title ?? ''}`))),
    );
  }
  const hero = renderPlaceholder(c, 'IMG-PLACEHOLDER-END');
  if (hero) summary.append(hero);

  const marker = r.failureHour == null ? null : { hour: r.failureHour, label: `lost on day ${Math.floor(r.failureHour / 24)}` };
  const raw = h('pre', { id: 'reference-output' });
  raw.textContent = JSON.stringify({ gates: d.gates, plar: d.plar, result: { ...r, telemetry: `${r.telemetry.length} rows` }, score }, null, 2);
  const flight = h('div', { class: 'debrief-col' },
    h('h3', {}, 'The flight year'),
    renderStripChart(r.telemetry, { title: 'Battery charge', unit: '%', value: (t) => t.batterySoCPercent, max: 100 }, hours, marker),
    renderStripChart(r.telemetry, { title: 'Solar power generated', unit: 'W', value: (t) => t.solarPowerGeneratedW }, hours, marker),
    renderStripChart(r.telemetry, { title: 'Data memory in use', unit: '%', value: (t) => t.ssmmBufferOccupancyPercent, max: 100 }, hours, marker),
    renderStripChart(r.telemetry, { title: 'Water ice assayed so far', unit: 'kg', value: (t) => t.cumulativeIceAssayedKg }, hours, marker),
    h('h3', {}, 'Events'),
    r.events.length
      ? h('ul', { class: 'events' }, ...r.events.map((e) => h('li', {}, `Day ${Math.floor(e.hour / 24)}: ${e.text}`)))
      : h('p', { class: 'hint' }, 'No events this year.'),
    h('details', {}, h('summary', {}, 'Raw result'), raw),
  );

  box.append(summary, flight);
  return box;
}
