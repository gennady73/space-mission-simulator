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

export function renderDebrief(c: EngineConstants, d: Debrief, actions: DebriefActions): HTMLElement {
  const { result: r, score } = d;
  const hours = c.simulation.mission_duration_h;
  const box = h('section', { class: 'debrief' });
  const hero = renderPlaceholder(c, 'IMG-PLACEHOLDER-END');
  if (hero) box.append(hero);
  box.append(renderGateBanner(d.plar));

  const tile = (label: string, value: string) => h('div', { class: 'tile' }, h('dt', {}, label), h('dd', {}, value));
  box.append(
    h('dl', { class: 'tiles' },
      tile('Mission score (game rule)', `${score.total} of 1000`),
      tile('Reviews passed', `${score.gatesPassed} of 5`),
      tile('Water ice assayed', `${Math.round(r.iceKg).toLocaleString('en-US')} kg`),
      tile('Operating time', `${r.uptimeHours} of ${hours} h`),
      tile('Science data delivered', `${(score.dataCompleteness * 100).toFixed(0)}%`),
      tile('Lowest battery charge', `${r.minSoCPercent.toFixed(0)}%`),
      tile('Cost against budget', `${usdM(d.costUSD)} of ${usdM(d.budgetUSD)}`),
    ),
    h('h2', {}, 'What happened, in order'),
    faultTree(d),
  );

  if (score.badges.length) {
    box.append(
      h('h2', {}, 'NASA technology shortfalls this design addressed'),
      h('ul', { class: 'badges' }, ...score.badges.map((id) => h('li', {}, h('strong', {}, id), ` ${c.shortfall_badges[id]?.title ?? ''}`))),
    );
  }

  box.append(h('h2', {}, 'The flight year'));
  box.append(
    renderStripChart(r.telemetry, { title: 'Battery charge', unit: '%', value: (t) => t.batterySoCPercent, max: 100 }, hours),
    renderStripChart(r.telemetry, { title: 'Solar power generated', unit: 'W', value: (t) => t.solarPowerGeneratedW }, hours),
    renderStripChart(r.telemetry, { title: 'Data memory in use', unit: '%', value: (t) => t.ssmmBufferOccupancyPercent, max: 100 }, hours),
    renderStripChart(r.telemetry, { title: 'Water ice assayed so far', unit: 'kg', value: (t) => t.cumulativeIceAssayedKg }, hours),
  );

  box.append(h('h2', {}, 'Events'));
  box.append(r.events.length
    ? h('ul', { class: 'events' }, ...r.events.map((e) => h('li', {}, `Day ${Math.floor(e.hour / 24)}: ${e.text}`)))
    : h('p', { class: 'hint' }, 'No events this year.'));

  const revise = h('button', { id: 'btn-revise-design', type: 'button' }, 'Change the design and fly again');
  revise.addEventListener('click', actions.revise);
  const exportBtn = h('button', { id: 'btn-export-design', type: 'button', class: 'secondary' }, 'Save design as a file');
  exportBtn.addEventListener('click', actions.exportJson);
  const share = h('button', { id: 'btn-share-design', type: 'button', class: 'secondary' }, 'Copy share link');
  share.addEventListener('click', actions.copyShareLink);
  box.append(h('div', { class: 'actions' }, revise, exportBtn, share));

  const raw = h('pre', { id: 'reference-output' });
  raw.textContent = JSON.stringify({ gates: d.gates, plar: d.plar, result: { ...r, telemetry: `${r.telemetry.length} rows` }, score }, null, 2);
  box.append(h('details', {}, h('summary', {}, 'Raw result'), raw));
  return box;
}
