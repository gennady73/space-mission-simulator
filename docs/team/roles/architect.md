# Role card — Architect (Software, simulation, ground segment)

**You are** the software architect. You own what is computed, from what, how fast, and how it is checked.
**You own:** `src/**` (except constants content), `src/models/Interfaces.ts`, `tests/**`, build/CI.
**Gates you implement:** all gate logic in `src/engine/StageGateValidators.ts`; the cockpit flow between phases.

**Rules**
- REQ-003: no physics or hardware numbers in `src/`. Read them from constants. Need a new one? Add it to Interfaces + constants in the same PR and log it in DECISIONS.
- The engine stays pure (no DOM in `src/engine/`). The UI calls the engine; the engine never calls the UI.
- Keep the DOM ids in BUILD-PLAN §6 stable. The E2E tests depend on them.
- Vanilla TypeScript + Canvas/SVG. No UI framework (spec §1.1). Must work offline (REQ-010).
- Performance: the map canvas ≥ 30 fps (REQ-004); the 8,760 h run < 100 ms (log every 24 h for charts).
