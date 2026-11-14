import './styles.css';
import { loadConstants } from './engine/ConstantsLoader';
import { runDesignGates } from './engine/StageGateValidators';
import { computeLedger, isResolved, resolveDesign } from './engine/SubsystemEngines';
import { runMission, scoreMission } from './engine/SimulationClock';
import { initialState, PHASES, REFERENCE_DESIGN, StateStore } from './models/StateStore';
import { renderPlaceholder } from './ui/GraphicPlaceholderView';
import type { EngineConstants } from './models/Interfaces';

/**
 * Bootstrapper. BUILD SHELL ONLY: proves constants → gates → 8,760 h run → score end to end.
 * The cockpit UI (CockpitHUD, CanvasMap2D, OrbitViewCanvas, TelemetryStripCharts, SideQuestModal,
 * FeynmanSummaryView) replaces renderShell() — see docs/BUILD-PLAN.md §6.
 */
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
  renderShell(app, c, store);
}

function renderShell(app: HTMLElement, c: EngineConstants, store: StateStore): void {
  app.replaceChildren();
  const header = document.createElement('header');
  header.className = 'cockpit-header';
  header.innerHTML = `<h1>Polar Outpost Pioneer</h1><ol class="phase-track">${PHASES.map((p) => `<li data-phase="${p}">${p}</li>`).join('')}</ol>`;
  app.append(header);
  const intro = renderPlaceholder(c, 'IMG-PLACEHOLDER-INTRO');
  if (intro) app.append(intro);

  const btn = document.createElement('button');
  btn.id = 'btn-run-reference';
  btn.textContent = 'Run the reference mission (8,760 h)';
  const out = document.createElement('pre');
  out.id = 'reference-output';
  btn.onclick = () => {
    store.update(REFERENCE_DESIGN);
    const r = resolveDesign(c, store.get());
    if (!isResolved(r)) { out.textContent = 'Missing: ' + r.missing.join(', '); return; }
    const budget = store.get().allocatedBudgetUSD;
    const gates = runDesignGates(c, r);
    const passed = Object.values(gates).filter((g) => g?.passed).length;
    const res = runMission(c, r, { seed: store.get().seed, randomEvents: c.difficulty_levels[store.get().difficulty].random_events_enabled, logEveryHours: 24 });
    const score = scoreMission(c, r, res, passed, budget);
    const ledger = computeLedger(c, r, budget);
    out.textContent = JSON.stringify({ gates, ledger, result: { ...res, telemetry: `${res.telemetry.length} rows` }, score }, null, 2);
  };
  app.append(btn, out);
}

void boot();
