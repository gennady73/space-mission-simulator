import './styles.css';
import { loadConstants } from './engine/ConstantsLoader';
import { runMission, scoreMission } from './engine/SimulationClock';
import { runDesignGates, totalCostUSD, validatePLAR } from './engine/StageGateValidators';
import { initialState, PHASES, REFERENCE_DESIGN, StateStore } from './models/StateStore';
import type { Difficulty, EngineConstants, GateValidationResult, Phase } from './models/Interfaces';
import { renderCockpit, type CockpitActions } from './ui/CockpitHUD';
import type { Debrief } from './ui/DebriefView';
import { provisionalDesign, submitToReview } from './ui/DesignFlow';

/** Telemetry rows kept for the charts: one every this many hours. Presentation only. */
const CHART_SAMPLE_HOURS = 6;

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  let c: EngineConstants;
  try {
    c = await loadConstants();
  } catch (e) {
    app.innerHTML = '<div class="gate-error-banner"><h2>Could not load engine constants</h2><pre></pre></div>';
    app.querySelector('pre')!.textContent = String(e);
    return;
  }
  const store = new StateStore(initialState(c));
  const shared = StateStore.fromShareHash(location.hash);
  if (shared) store.importDesign(shared);

  let banner: GateValidationResult | null = null;
  let debrief: Debrief | null = null;
  let padDistanceDraft = store.get().padDistanceM?.toString() ?? '';
  let heaterDraft = store.get().drillHeaterW.toString();

  /** Copy the two typed numbers into the state without a re-render in between. */
  const draftPatch = () => {
    const distance = Number.parseFloat(padDistanceDraft);
    const heater = Number.parseFloat(heaterDraft);
    return { padDistanceM: Number.isFinite(distance) ? distance : null, drillHeaterW: Number.isFinite(heater) ? heater : 0 };
  };

  /** Fly the year for a design that has been through all four design reviews. */
  const fly = (gates: Partial<Record<Phase, GateValidationResult>>): void => {
    const s = store.get();
    const { design } = provisionalDesign(c, s);
    if (!design) return;
    const result = runMission(c, design, { seed: s.seed, randomEvents: c.difficulty_levels[s.difficulty].random_events_enabled, logEveryHours: CHART_SAMPLE_HOURS });
    const passed = Object.values(gates).filter((g) => g?.passed).length;
    const costUSD = totalCostUSD(design);
    const plar = validatePLAR(result.uptimeHours, c.simulation.mission_duration_h, costUSD, s.allocatedBudgetUSD);
    debrief = { result, score: scoreMission(c, design, result, passed, s.allocatedBudgetUSD), plar, gates, costUSD, budgetUSD: s.allocatedBudgetUSD };
    banner = null;
    store.update({ currentPhase: 'PLAR', gateResults: { ...gates, PLAR: plar }, telemetryLog: result.telemetry, remainingBudgetUSD: s.allocatedBudgetUSD - costUSD });
  };

  const actions: CockpitActions = {
    update: (patch) => { banner = null; store.update(patch); },
    setPadDistanceDraft: (v) => { padDistanceDraft = v; },
    setHeaterDraft: (v) => { heaterDraft = v; },
    setDifficulty: (id) => {
      const difficulty = id as Difficulty;
      const budget = c.difficulty_levels[difficulty].budget_usd;
      store.update({ difficulty, allocatedBudgetUSD: budget, remainingBudgetUSD: budget });
    },
    nextPhase: () => {
      const phase = store.get().currentPhase;
      const candidate = { ...store.get(), ...draftPatch() };
      const results = submitToReview(c, candidate, phase);
      const failed = Object.values(results).find((g) => g && !g.passed) ?? null;
      const gateResults = { ...candidate.gateResults, ...results };
      if (failed) { banner = failed; store.update({ ...draftPatch(), gateResults }); return; }
      if (phase === 'CDR') { store.update(draftPatch()); fly(results); return; }
      banner = null;
      store.update({ ...draftPatch(), gateResults, currentPhase: PHASES[PHASES.indexOf(phase) + 1] });
    },
    goToPhase: (phase) => {
      if (phase === 'PLAR' && !debrief) return;
      banner = null;
      store.update({ ...draftPatch(), currentPhase: phase });
    },
    runReference: () => {
      store.update({ ...REFERENCE_DESIGN, gateResults: {} });
      padDistanceDraft = String(REFERENCE_DESIGN.padDistanceM ?? '');
      heaterDraft = String(REFERENCE_DESIGN.drillHeaterW);
      const { design } = provisionalDesign(c, store.get());
      if (design) fly(runDesignGates(c, design));
    },
    revise: () => { banner = null; debrief = null; store.update({ currentPhase: 'MCR' }); },
    exportJson: () => {
      const blob = new Blob([JSON.stringify(store.exportDesign(), null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'polar-outpost-design.json';
      link.click();
      URL.revokeObjectURL(link.href);
    },
    copyShareLink: () => {
      const url = location.href.split('#')[0] + store.toShareHash();
      history.replaceState(null, '', url);
      void navigator.clipboard?.writeText(url);
    },
  };

  store.subscribe((state) => renderCockpit(app, { constants: c, state, banner, padDistanceDraft, heaterDraft, debrief }, actions));
}

void boot();
