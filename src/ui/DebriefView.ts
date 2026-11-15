import type { SimulationResult } from '../engine/SimulationClock';
import type { EngineConstants, GateValidationResult, MissionDesignExport, MissionScore, Phase } from '../models/Interfaces';
import { designDifferences, type BestOutcome, type RunSummary } from './bestRuns';
import { h, usdM } from './dom';
import { renderPlaceholder } from './GraphicPlaceholderView';
import { DESIGN_PHASES } from './DesignFlow';
import { renderStickyNote } from './StickyNote';

export interface Debrief {
  result: SimulationResult;
  score: MissionScore;
  plar: GateValidationResult;
  gates: Partial<Record<Phase, GateValidationResult>>;
  costUSD: number;
  budgetUSD: number;
  /** Water target when the run flew the ice prospecting challenge (D-040); absent otherwise. */
  waterTargetKg?: number;
  /** Personal best at this difficulty; absent for the reference mission. */
  best?: BestOutcome & { run: RunSummary; mine: MissionDesignExport; difficultyLabel: string };
}

export interface DebriefActions {
  revise(): void;
  exportJson(): void;
  copyShareLink(): void;
  loadDesign(design: MissionDesignExport, where: Phase): void;
}

/**
 * A review verdict as a sticky note (Media, D-304): a failed gate is a mistake note (title, what went
 * wrong, then the fix after the divider), a passed gate a success note. The wording is the validators'.
 * The classes gate-error-banner / gate-pass-banner and the reason code stay for the e2e contract.
 * `onClose` makes the note dismissable where it sits on the panel; the review modal passes none.
 */
export function renderGateBanner(g: GateValidationResult, onClose?: () => void): HTMLElement {
  const standard = h('small', {}, `${g.governingStandard} · ${g.reasonCode}`);
  return renderStickyNote({
    kind: g.passed ? 'success' : 'mistake',
    class: g.passed ? 'gate-pass-banner' : 'gate-error-banner',
    title: g.passed ? `${g.gateName}: passed` : `${g.gateName}: not passed`,
    body: g.diagnosticExplanation,
    footer: g.passed ? standard : h('div', {}, h('p', {}, `What to change: ${g.remediationAction}`), standard),
    ...(onClose ? { onClose } : {}),
  });
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
 * score, what happened and the badges. Right column: the year's events and the raw result.
 * The year's charts live in the operations replay (D-120).
 */
export function renderDebrief(c: EngineConstants, d: Debrief, actions: DebriefActions): HTMLElement {
  const { result: r, score } = d;
  const hours = c.simulation.mission_duration_h;
  const box = h('section', { class: 'debrief' });

  const revise = h('button', { id: 'btn-revise-design', type: 'button' }, 'Improve the design \u2192 back to Ice (CDR)');
  revise.addEventListener('click', actions.revise);
  const exportBtn = h('button', { id: 'btn-export-design', type: 'button', class: 'secondary' }, 'Save design as a file');
  exportBtn.addEventListener('click', actions.exportJson);
  const share = h('button', { id: 'btn-share-design', type: 'button', class: 'secondary' }, 'Copy share link');
  share.addEventListener('click', actions.copyShareLink);

  const tile = (label: string, value: string) => h('div', { class: 'tile' }, h('dt', {}, label), h('dd', {}, value));
  const lostDay = r.failureHour == null ? null : Math.floor(r.failureHour / 24);
  const outcome = lostDay == null
    ? `Your outpost survived the year: ${Math.round(r.iceKg).toLocaleString('en-US')} kg of water ice assayed.`
    : `Your outpost was lost on day ${lostDay} of 365.`;
  const summary = h('div', { class: 'debrief-col' },
    h('p', { class: 'debrief-crumb' }, 'The year is over. This is mission control\u2019s debrief: what your design did, and where to improve it.'),
    h('h2', { class: lostDay == null ? 'debrief-outcome ok' : 'debrief-outcome bad' }, outcome),
    h('div', { class: 'debrief-score', id: 'debrief-score' },
      h('span', {}, 'Mission score (game rule)'), h('strong', {}, String(score.total)), h('span', {}, 'of 1000')),
    h('div', { class: 'actions' },
      revise,
      h('p', { class: 'hint' }, 'Your design is kept. Change anything in any stage, then launch again from the Ice (CDR) review.'),
      exportBtn, share),
    renderGateBanner(d.plar),
    h('dl', { class: 'tiles' },
      tile('Reviews passed', `${score.gatesPassed} of 5`),
      tile(d.waterTargetKg ? 'Water against the challenge target' : 'Water ice assayed', `${Math.round(r.iceKg).toLocaleString('en-US')} kg${d.waterTargetKg ? ` of ${d.waterTargetKg.toLocaleString('en-US')} kg` : ''}`),
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

  const raw = h('pre', { id: 'reference-output' });
  raw.textContent = JSON.stringify({ gates: d.gates, plar: d.plar, result: { ...r, telemetry: `${r.telemetry.length} rows` }, score }, null, 2);
  const flight = h('div', { class: 'debrief-col' },
    h('h3', {}, 'Events'),
    r.events.length
      ? h('ul', { class: 'events' }, ...r.events.map((e) => h('li', {}, `Day ${Math.floor(e.hour / 24)}: ${e.text}`)))
      : h('p', { class: 'hint' }, 'No events this year.'),
    h('details', {}, h('summary', {}, 'Raw result'), raw),
  );

  const compare = bestPanel(c, d, actions);
  if (compare) flight.prepend(compare);
  box.append(summary, flight);
  return box;
}

/**
 * "Your best" (UI review items 5 and 7): this run against the best one flown at this difficulty
 * in this browser, side by side, with the design choices that differ. A first flight sets the target.
 */
function bestPanel(c: EngineConstants, d: Debrief, actions: DebriefActions): HTMLElement | null {
  const b = d.best;
  if (!b) return null;
  const box = h('section', { id: 'debrief-best', class: 'debrief-best', 'aria-label': 'Compare with your best' });
  const level = b.difficultyLabel;
  if (!b.previous) {
    box.append(h('h3', {}, `Your best on ${level}`),
      h('p', { id: 'best-headline' }, `First flight on ${level}: ${b.run.score} is the score to beat. Improve the design and fly again.`));
    return box;
  }
  const p = b.previous;
  const diffs = designDifferences(c, b.mine.design, p.design.design);
  box.append(h('h3', {}, b.isNew ? `New best on ${level}!` : `Your best on ${level}`),
    h('p', { id: 'best-headline' }, b.isNew
      ? `${b.run.score}, up from ${p.score}. Here is what changed against your previous best.`
      : b.run.score === p.score ? `You matched your best of ${p.score}. Change a choice and try to beat it.`
        : `Your best is ${p.score}; this run scored ${b.run.score}. Here is how they differ.`));
  const other = b.isNew ? 'Previous best' : 'Your best';
  const row = (label: string, mine: string, theirs: string, better: boolean | null) =>
    h('tr', { class: better === null ? '' : better ? 'better' : 'worse' }, h('th', { scope: 'row' }, label), h('td', {}, mine), h('td', {}, theirs));
  const cmp = (a: number, z: number, higherIsBetter: boolean) => (a === z ? null : (a > z) === higherIsBetter);
  const kgText = (v: number) => `${Math.round(v).toLocaleString('en-US')} kg`;
  const pctText = (v: number) => `${(v * 100).toFixed(0)}%`;
  const fate = (r: RunSummary) => (r.lostDay == null ? 'whole year' : `lost on day ${r.lostDay}`);
  box.append(h('table', { class: 'compare' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', { scope: 'col' }, 'This run'), h('th', { scope: 'col' }, other))),
    h('tbody', {},
      row('Score', String(b.run.score), String(p.score), cmp(b.run.score, p.score, true)),
      row('Outpost', fate(b.run), fate(p), cmp(b.run.uptimeHours, p.uptimeHours, true)),
      row('Water ice', kgText(b.run.iceKg), kgText(p.iceKg), cmp(Math.round(b.run.iceKg), Math.round(p.iceKg), true)),
      row('Data delivered', pctText(b.run.dataCompleteness), pctText(p.dataCompleteness), cmp(Math.round(b.run.dataCompleteness * 100), Math.round(p.dataCompleteness * 100), true)),
      row('Lowest battery', `${b.run.minSoCPercent.toFixed(0)}%`, `${p.minSoCPercent.toFixed(0)}%`, cmp(Math.round(b.run.minSoCPercent), Math.round(p.minSoCPercent), true)),
      row('Cost', usdM(b.run.costUSD), usdM(p.costUSD), cmp(b.run.costUSD, p.costUSD, false)),
    )));
  box.append(diffs.length
    ? h('table', { class: 'compare compare-design', id: 'best-differences' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Choice'), h('th', { scope: 'col' }, 'This run'), h('th', { scope: 'col' }, other))),
      h('tbody', {}, ...diffs.map((x) => h('tr', {}, h('th', { scope: 'row' }, x.label), h('td', {}, x.mine), h('td', {}, x.best)))))
    : h('p', { class: 'hint' }, b.run.score === p.score ? 'Same design choices as your best.' : 'Same design choices; the difference comes from the year\u2019s random events.'));
  if (!b.isNew) {
    const load = h('button', { id: 'btn-load-best', type: 'button', class: 'secondary' }, 'Load your best design');
    load.addEventListener('click', () => actions.loadDesign(p.design, 'CDR'));
    box.append(load);
  }
  return box;
}
