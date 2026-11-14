# Handover — Architect

Newest block on top. One block per session. The Lead writes in `lead.md`, never here (D-015).

---

## 2026-11-14 ~17:30 IST · Architect (Claude, Architect instance) · cockpit
**Did**
- First real install and test run of the bootstrap. `npm test` failed on a clean install because Vitest picked up the Playwright file; fixed in `vite.config.ts` (D-025).
- Built the cockpit on the engine contract, engine untouched: `src/ui/CockpitHUD.ts` (header, phase tracker, difficulty, six-resource bar, choice cards for every catalog), `DesignFlow.ts` (which choices each review needs, D-023), `DebriefView.ts` (PLAR result, score tiles, step-by-step outcome, badges, events, export and share), `TelemetryStripCharts.ts` (four SVG strip charts with hover readout), `dom.ts`.
- `main.ts` now wires the store to the cockpit. A player can go MCR → SRR → PDR → CDR → flight year → debrief → revise, entirely on screen.
- E2E suite: the two `fixme` tests are on, plus four new ones (plume failure, incomplete design, full on-screen mission, CDR heater).

**Verification:** `tsc --noEmit` clean · 18 unit tests pass · 8 Playwright tests pass · production build succeeds · PDR failure screen and debrief checked in a browser, no console errors other than the missing placeholder images.

**Added ~17:50 IST: team play (D-026).** Hot-seat for four seats, per-seat decisions, sign-off by the gate owner, one new Playwright test (9 pass in total).

**Not done (BUILD-PLAN §3)**
- Objective + hypothesis screen: only a mission objective field on MCR. The §8.1 questions are not in the constants yet, so they need a `pre_stage_questions` block (Lead) before the UI can show them without numbers in `src/`.
- Compare two designs, JSON import (export and share link work), side-quest modals, About & Numbers, map. Comms & Science owns no review, so that seat never signs off.
- Badges are listed without their rank; ranks are verified now (D-022) and can be shown.

**Notes for the Lead**
- Rebased onto `4fb12cd` (Lead's Rule 1.06 margins, D-021/D-022). The cockpit now reads `minimum_power_margin_pdr`; my decision rows were renumbered D-023 to D-026 to follow the Lead's.
- Side-quest margins use an 85 W load, while the PDR gate uses the design's own load (93 W for the reference bus and storage). A quest that names a pack size should say which load it assumes.
- `fallback_badge` values already contain square brackets; the view prints them as they are.
- BUILD-PLAN §6 should take the ids listed in D-024. `CONTEXT.md` item 1 (cockpit) can move to Green.

**Next (Architect)**
1. JSON import and compare view.
2. Hypothesis prompts once the constants carry them.
3. Telemetry charts on a failed mission need a marker at the failure hour.

---

## (bootstrap note from the Lead)
**Start here:** `CLAUDE.md` → BUILD-PLAN §3 (your Must items) and §6 (the engine↔UI contract, DOM ids).
The engine is done and pure. Build the cockpit around `resolveDesign` / `computeLedger` / `runDesignGates` / `runMission` / `scoreMission`.
