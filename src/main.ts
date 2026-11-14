import './styles.css';
import { loadConstants } from './engine/ConstantsLoader';
import { runMission, scoreMission } from './engine/SimulationClock';
import { runDesignGates, totalCostUSD, validatePLAR } from './engine/StageGateValidators';
import { initialState, PHASES, REFERENCE_DESIGN, StateStore } from './models/StateStore';
import { renderAboutNumbers } from './ui/AboutNumbersView';
import { renderMapDemo } from './ui/map/mapDemo';
import { renderSiteMap, type SiteMapHandle } from './ui/map/SiteMap';
import { createFlightPlayback, type FlightPlaybackHandle } from './ui/map/FlightPlayback';
import type { Difficulty, EngineConstants, GateValidationResult, Phase, SimulationState, TeamRole } from './models/Interfaces';
import { h } from './ui/dom';
import { renderCockpit, type CockpitActions } from './ui/CockpitHUD';
import type { Debrief } from './ui/DebriefView';
import type { ReviewOutcome } from './ui/ReviewModal';
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
  // Lead: About & Numbers page at #about (keep this route when the cockpit replaces the shell).
  if (location.hash === '#about') { app.replaceChildren(renderAboutNumbers(c)); return; }
  // Lead: map test page at #map (D-104).
  if (location.hash === '#map') { renderMapDemo(app, c); return; }
  const store = new StateStore(initialState(c));
  const shared = StateStore.fromShareHash(location.hash);
  if (shared) store.importDesign(shared);

  let banner: GateValidationResult | null = null;
  let debrief: Debrief | null = null;
  let review: ReviewOutcome | null = null;
  // Console viewport (BUILD-PLAN §6): one persistent element that the cockpit re-adopts on every
  // render, so the map canvas and the flight playback live across re-renders.
  const viewport = h('div', { id: 'console-viewport', class: 'viewport' });
  let map: SiteMapHandle | null = null;
  let flight: FlightPlaybackHandle | null = null;
  let padDistanceDraft = store.get().padDistanceM?.toString() ?? '';
  let heaterDraft = store.get().drillHeaterW.toString();

  /** Copy the two typed numbers into the state without a re-render in between. */
  const draftPatch = () => {
    const distance = Number.parseFloat(padDistanceDraft);
    const heater = Number.parseFloat(heaterDraft);
    return { padDistanceM: Number.isFinite(distance) ? distance : null, drillHeaterW: Number.isFinite(heater) ? heater : 0 };
  };

  /**
   * Fly the year for a design that has been through all four design reviews: run the engine once
   * with hourly telemetry, replay it as the flight playback (D-105) in the console viewport, and
   * show the debrief when the player asks for it.
   */
  const fly = (gates: Partial<Record<Phase, GateValidationResult>>): void => {
    const s = store.get();
    const { design } = provisionalDesign(c, s);
    if (!design) return;
    const result = runMission(c, design, { seed: s.seed, randomEvents: c.difficulty_levels[s.difficulty].random_events_enabled, logEveryHours: 1 });
    // The playback reads every hour; the debrief strip charts keep one row in CHART_SAMPLE_HOURS.
    const sampled = result.telemetry.filter((t, i, all) => t.hour % CHART_SAMPLE_HOURS === 0 || i === all.length - 1);
    const passed = Object.values(gates).filter((g) => g?.passed).length;
    const costUSD = totalCostUSD(design);
    const plar = validatePLAR(result.uptimeHours, c.simulation.mission_duration_h, costUSD, s.allocatedBudgetUSD);
    debrief = { result: { ...result, telemetry: sampled }, score: scoreMission(c, design, result, passed, s.allocatedBudgetUSD), plar, gates, costUSD, budgetUSD: s.allocatedBudgetUSD };
    banner = null;
    const land = (): void => {
      flight?.destroy();
      flight = null;
      store.update({ isSimulationRunning: false, currentPhase: 'PLAR', gateResults: { ...gates, PLAR: plar }, telemetryLog: sampled, remainingBudgetUSD: s.allocatedBudgetUSD - costUSD });
    };
    map?.destroy();
    map = null;
    flight?.destroy();
    flight = createFlightPlayback(viewport, c, s, result, { onFinish: land });
    store.update({ isSimulationRunning: true });
  };

  /** Keep the site map (D-104) in the viewport during the design phases; the playback owns it in flight. */
  const syncViewport = (state: SimulationState): void => {
    if (state.isSimulationRunning) return;
    if (state.currentPhase === 'PLAR') { map?.destroy(); map = null; return; }
    const stage = state.currentPhase;
    if (map) map.update(state, { stage });
    else map = renderSiteMap(viewport, c, state, { stage, onSelectSite: (id) => actions.update({ selectedSite: id }) });
  };

  const actions: CockpitActions = {
    update: (patch) => { banner = null; store.update(patch); },
    setPadDistanceDraft: (v) => { padDistanceDraft = v; },
    // Keeps any gate banner on screen: writing a hypothesis is not a design change.
    recordHypothesis: (phase, text) => store.update({ userHypotheses: { ...store.get().userHypotheses, [phase]: text } }),
    setHeaterDraft: (v) => { heaterDraft = v; },
    setDifficulty: (id) => {
      const difficulty = id as Difficulty;
      const budget = c.difficulty_levels[difficulty].budget_usd;
      store.update({ difficulty, allocatedBudgetUSD: budget, remainingBudgetUSD: budget });
    },
    setTeamMode: (on) => {
      const first = Object.keys(c.team_roles)[0] as TeamRole;
      store.update({ ...draftPatch(), teamMode: on, activeRole: on ? store.get().activeRole ?? first : null });
    },
    setActiveRole: (role) => store.update({ ...draftPatch(), activeRole: role }),
    // Submitting runs the gates and opens the review verdict (D-035); the player then moves on or revises.
    nextPhase: () => {
      const phase = store.get().currentPhase;
      const candidate = { ...store.get(), ...draftPatch() };
      const results = submitToReview(c, candidate, phase);
      const failed = Object.values(results).find((g) => g && !g.passed) ?? null;
      const gateResults = { ...candidate.gateResults, ...results };
      // D-010: the seat that submits a passed review is recorded as having signed it off.
      const signer = candidate.teamMode ? candidate.activeRole : null;
      const roleSignOffs = signer && !failed ? { ...candidate.roleSignOffs, [phase]: [signer] } : candidate.roleSignOffs;
      review = { phase, results, failed };
      banner = null;
      store.update({ ...draftPatch(), gateResults, roleSignOffs });
    },
    reviewNext: () => {
      if (!review || review.failed) return;
      const { phase, results } = review;
      review = null;
      if (phase === 'CDR') { fly(results); return; }
      store.update({ currentPhase: PHASES[PHASES.indexOf(phase) + 1] });
    },
    // After a failed review the verdict stays on the panel as a reminder of what to fix.
    reviewRevise: () => { banner = review?.failed ?? null; review = null; store.update({}); },
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

  store.subscribe((state) => {
    syncViewport(state);
    renderCockpit(app, { constants: c, state, banner, padDistanceDraft, heaterDraft, debrief, review, viewport }, actions);
  });
}

void boot();
