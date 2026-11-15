import './styles.css';
import { loadConstants } from './engine/ConstantsLoader';
import { runMission, scoreMission } from './engine/SimulationClock';
import { runDesignGates, totalCostUSD, validatePLAR } from './engine/StageGateValidators';
import { initialState, PHASES, REFERENCE_DESIGN, StateStore } from './models/StateStore';
import { renderAboutNumbers } from './ui/AboutNumbersView';
import { renderMapDemo } from './ui/map/mapDemo';
import { renderSiteMap, type SiteMapHandle } from './ui/map/SiteMap';
import { createFlightPlayback, type FlightPlaybackHandle } from './ui/map/FlightPlayback';
import type { Difficulty, EngineConstants, GateValidationResult, MissionDesignExport, Phase, SimulationState, TeamRole } from './models/Interfaces';
import { recordRun } from './ui/bestRuns';
import { h } from './ui/dom';
import { lockFor, renderCockpit, type CockpitActions } from './ui/CockpitHUD';
import { renderStickyShowcase } from './ui/StickyNoteShowcase';
import type { Debrief } from './ui/DebriefView';
import type { ReviewOutcome } from './ui/ReviewModal';
import { provisionalDesign, submitToReview } from './ui/DesignFlow';
import { renderHome, type HomeHandle, type StartMode } from './ui/home/HomeView';
import { loadUiConfig, type UiConfig } from './ui/home/uiConfig';

/** Telemetry rows kept for the charts: one every this many hours. Presentation only. */
const CHART_SAMPLE_HOURS = 6;

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  let c: EngineConstants;
  let ui: UiConfig | null = null;
  try {
    // Both files load at once. A missing ui-config only skips the landing page; it never blocks the game.
    [c, ui] = await Promise.all([loadConstants(), loadUiConfig().catch(() => null)]);
  } catch (e) {
    app.innerHTML = '<div class="gate-error-banner"><h2>Could not load engine constants</h2><pre></pre></div>';
    app.querySelector('pre')!.textContent = String(e);
    return;
  }
  // Lead: map test page at #map (D-104).
  if (location.hash === '#map') { renderMapDemo(app, c); return; }
  // Media: sticky-note design check page at #notes (D-304), like #map.
  if (location.hash === '#notes') { renderStickyShowcase(app); return; }
  // Cockpit at #mission; share links (#design=…) still land straight in it (D-301).
  if (location.hash === '#mission' || location.hash.startsWith('#design=')) { startConsole(app, c, 'mission'); return; }
  // The landing page and the Lead's About & Numbers page (#about) hold no state, so a hash change
  // just swaps them in place: no reload, and the browser Back button works (D-301).
  let home: HomeHandle | null = null;
  const showPage = (): void => {
    home?.destroy();
    home = null;
    if (location.hash === '#about') { app.replaceChildren(renderAboutNumbers(c)); return; }
    if (!ui) { removeEventListener('hashchange', showPage); startConsole(app, c, 'mission'); return; }
    home = renderHome(app, ui, (mode) => { removeEventListener('hashchange', showPage); history.replaceState(null, '', '#mission'); startConsole(app, c, mode); });
  };
  addEventListener('hashchange', showPage);
  showPage();
}

/**
 * The mission console (cockpit): state store, viewport, actions and the render loop.
 * Mounted at #mission and for #design= share links, or when the landing page's START is pressed (D-301).
 */
function startConsole(app: HTMLElement, c: EngineConstants, mode: StartMode): void {
  const store = new StateStore(initialState(c));
  const shared = StateStore.fromShareHash(location.hash);
  if (shared) store.importDesign(shared);

  let banner: GateValidationResult | null = null;
  // Start screen (D-113): shown on a fresh load; a shared design goes straight to the console.
  let notice: string | null = null;
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
  const fly = (gates: Partial<Record<Phase, GateValidationResult>>, playerRun = true): void => {
    const s = store.get();
    const { design } = provisionalDesign(c, s);
    if (!design) return;
    const result = runMission(c, design, { seed: s.seed, randomEvents: c.difficulty_levels[s.difficulty].random_events_enabled, logEveryHours: 1 });
    // The playback reads every hour; the debrief strip charts keep one row in CHART_SAMPLE_HOURS.
    const sampled = result.telemetry.filter((t, i, all) => t.hour % CHART_SAMPLE_HOURS === 0 || i === all.length - 1);
    const passed = Object.values(gates).filter((g) => g?.passed).length;
    const costUSD = totalCostUSD(design);
    const plar = validatePLAR(result.uptimeHours, c.simulation.mission_duration_h, costUSD, s.allocatedBudgetUSD);
    const score = scoreMission(c, design, result, passed, s.allocatedBudgetUSD);
    debrief = {
      result: { ...result, telemetry: sampled }, score, plar, gates, costUSD, budgetUSD: s.allocatedBudgetUSD,
      ...(design.iceProspecting ? { waterTargetKg: c.ice_prospecting.water_target_kg } : {}),
    };
    // Personal best per difficulty (UI review items 5 and 7). The reference mission is not the player's run.
    if (playerRun) {
      const mine = store.exportDesign();
      const run = {
        score: score.total, iceKg: result.iceKg, dataCompleteness: score.dataCompleteness, uptimeHours: result.uptimeHours,
        minSoCPercent: result.minSoCPercent, costUSD, lostDay: result.failureHour == null ? null : Math.floor(result.failureHour / 24),
      };
      debrief.best = { ...recordRun(s.difficulty, run, mine), run, mine, difficultyLabel: c.difficulty_levels[s.difficulty].label };
    }
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
    else map = renderSiteMap(viewport, c, state, {
      stage,
      // A locked seat cannot change the site from the map either (team play, D-303).
      onSelectSite: (id) => { if (lockFor(c, store.get(), 'landing site')) return; actions.update({ selectedSite: id }); },
      // Lead: tapping the SRR map places the solar mast; the distance is the same value as the typed field.
      onPlaceMast: (distanceM) => { padDistanceDraft = String(distanceM); actions.update({ padDistanceM: distanceM }); },
    });
  };

  const actions: CockpitActions = {
    update: (patch) => { banner = null; store.update(patch); },
    dismissBanner: () => { banner = null; store.update({}); }, // the note's close (D-304); the next failed review brings a new note
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
      notice = null;
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
      notice = null;
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
      notice = null;
      store.update({ ...draftPatch(), currentPhase: phase });
    },
    runReference: () => {
      store.update({ ...REFERENCE_DESIGN, gateResults: {} });
      padDistanceDraft = String(REFERENCE_DESIGN.padDistanceM ?? '');
      heaterDraft = String(REFERENCE_DESIGN.drillHeaterW);
      const { design } = provisionalDesign(c, store.get());
      if (design) fly(runDesignGates(c, design), false);
    },
    // Back to the last design stage: the whole design is still there to change, stage by stage.
    revise: () => {
      banner = null;
      debrief = null;
      notice = 'Back from the debrief. Your whole design is still here \u2014 change what you need in any stage, then submit the Ice (CDR) review to launch again.';
      store.update({ currentPhase: 'CDR' });
    },
    loadDesign: (blob, where) => loadDesign(blob, where),
    importFile: (file) => {
      void file.text().then((text) => {
        try { loadDesign(JSON.parse(text) as MissionDesignExport, 'MCR'); }
        catch { notice = `"${file.name}" is not a design file saved by this game.`; store.update({}); }
      });
    },
    exportJson: () => {
      const blob = new Blob([JSON.stringify(store.exportDesign(), null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'lighthouse-on-the-trail-design.json';
      link.click();
      URL.revokeObjectURL(link.href);
    },
    copyShareLink: () => {
      const url = location.href.split('#')[0] + store.toShareHash();
      history.replaceState(null, '', url);
      void navigator.clipboard?.writeText(url);
    },
  };

  /** Put a saved design in the console (file import or "load your best"), with its drafts, and start at `where`. */
  function loadDesign(blob: MissionDesignExport, where: Phase): void {
    store.importDesign(blob);
    const s = store.get();
    padDistanceDraft = s.padDistanceM?.toString() ?? '';
    heaterDraft = s.drillHeaterW.toString();
    banner = null;
    debrief = null;
    review = null;
    notice = where === 'CDR'
      ? 'Your best design is loaded. Change anything in any stage, then submit the Ice (CDR) review to fly it again.'
      : 'Design loaded. Walk the stages with the pills above and submit each review, or jump to Ice (CDR) and launch.';
    store.update({ currentPhase: where });
  }

  store.subscribe((state) => {
    syncViewport(state);
    renderCockpit(app, { constants: c, state, banner, notice, padDistanceDraft, heaterDraft, debrief, review, viewport }, actions);
  });

  // How the player came in from the landing page (D-301): the example tour, the flown example, or team play.
  if (mode === 'example') {
    padDistanceDraft = String(REFERENCE_DESIGN.padDistanceM ?? '');
    heaterDraft = String(REFERENCE_DESIGN.drillHeaterW);
    notice = 'The example design is loaded, with every choice already made. Walk the stages with the pills above, read why each choice was made, and submit each review yourself.';
    store.update({ ...REFERENCE_DESIGN, currentPhase: 'MCR', gateResults: {} });
  } else if (mode === 'watch') {
    actions.runReference();
  } else if (mode === 'team') {
    actions.setTeamMode(true);
  }
}

void boot();
