# Handover — Architect

Newest block on top. One block per session. The Lead writes in `lead.md`, never here (D-015).

---

## 2026-11-15 ~15:25 IST · Architect (Claude, project thread for Andronis) · ice prospecting challenge (D-040)
**Did**
- Optional mission challenge on the Concept panel: the year is scored against a 6,000 kg water target. At CDR it opens a drill-string choice (1 m, 2 m, 3 m) and makes heater power above the minimum produce water. Details and measured scores: D-040.
- Engine: `iceRateKgPerHour`, `iceTargetKg`, `ResolvedDesign.drillOption` and `.iceProspecting`; the drill string adds mass, cost and peak drill power. Constants: new `ice_prospecting` block with one provenance entry (game rule).
- With the challenge off nothing changes (reference 816).

**Verification:** `tsc --noEmit` clean · 57 unit tests pass (9 new in `tests/ice-prospecting.spec.ts`) · played in Chromium from the toggle to the debrief (3 m auger on the cable: 820, 6,894 kg of 6,000 kg), no page errors. The Playwright suite was not run.

**For others**
- Hardware: review every value in `ice_prospecting` (all game rules).
- Media: review the challenge and drill-string texts in the constants and the two labels in `CockpitHUD.ts`.
- Lead: BUILD-PLAN section 6 ids `#toggle-ice-prospecting`, `#btn-drill-<id>`, `#hint-thermal-extraction`. The 3 m auger on the cable currently beats every other challenge design at Shackleton; the cable's 12% snag risk is its only cost there, so the cable price or the auger's mass may want tuning.

---

## 2026-11-15 ~00:30 IST · Architect (Claude, Architect instance) · full-screen mission console
**Did** (four PRs: shell #14, panel #15, review modal #16, debrief overlay)
- D-033 shell: `#app.console-host`, fixed 100dvh grid, no page scroll; top bar (title, MCR→FLY track, six compact resource tiles, Reference mission, menu with team/difficulty/export/share/About); viewport left ~60%, panel right ~40% and the only scroller; under 900 px the map (45vh) stacks over the panel; controls ≥ 40 px. New e2e: full mission at 1024×768 asserting `scrollHeight <= innerHeight` at every beat.
- D-034 panel: briefing card, objectives checklist (`#objectives`, `#objective-<key>`, `#objectives-status`), stage-only choice cards + side-quests, sticky submit bar.
- D-035 review modal: submit runs the gates and opens `#review-modal` with the verdict, reason, fix and a pill per re-run review; pass → `#btn-review-next` (Launch after CDR), fail → `#btn-review-revise` and the banner stays on the panel. Passing no longer auto-advances (one click added to the Lead's side-quest e2e).
- D-036 debrief: full-viewport overlay, score left, charts right with a failure-hour marker; Revise returns to CDR, design intact.

**Notes for Media/Lead**
- Id changes: `#btn-phase-FLY` (was `-PLAR`); team toggle and difficulty behind `#btn-menu`; export/share also as `#btn-menu-export`/`#btn-menu-share`. BUILD-PLAN §6 should take D-033..D-036.
- Per-stage placeholder art cards are gone (intro + END stay); stage art could live in the map HUD.

**Next (Architect)** — JSON import + compare view; a defeat/victory sting on the debrief would land well if Media has time.

---

## 2026-11-14 ~21:25 IST · Architect (Claude, Architect instance) · map + flight in the cockpit
**Did**
- Wired the Lead's D-104 map and D-105 flight playback into the game (D-032). One persistent `#console-viewport` element lives in `main.ts` and the cockpit re-adopts it on every render, so the canvas and the playback's animation loop survive re-renders. Map shows through MCR–CDR (`map.update` after every state change, site tap selects at MCR); at launch the engine runs with `logEveryHours: 1`, the map is destroyed and the playback takes the viewport; `onFinish` lands at PLAR with the debrief.
- Debrief strip charts keep one telemetry row in 6 (sampled from the hourly run), so the debrief stays light while the gauges are smooth.
- In flight the cockpit renders only the header and the viewport (no phase jumps mid-flight). Viewport heights: `min(62vh, 540px)` design, `min(82vh, 780px)` flight.
- The per-stage placeholder art cards are replaced by the live map; intro (MCR, pre-site) and END (debrief) cards stay. Media: if stage art still matters, it can live inside the map HUD instead.
- E2E: launches now pass through the playback (`#btn-flight-skip` → `#btn-flight-debrief` helper), plus a viewport test. 31 unit + 12 e2e green, typecheck and build clean; checked `/#map` → FLY and the full in-cockpit flow with screenshots.

**Next (Architect)** — JSON import + compare; failure-hour marker on the debrief charts (the playback already marks it on the scrubber).

---

## 2026-11-14 ~18:40 IST · Architect (Claude, Architect instance) · hypothesis screen
**Did**
- Pre-stage hypothesis card (`src/ui/PreStageQuestion.ts`, D-031) on every phase, fed by D-030's `pre_stage_questions`: question first, textarea for the player's hypothesis, explanation revealed only after a non-empty hypothesis is recorded. Hypotheses sit in `state.userHypotheses`, so export / import / share carry them.
- E2E test for the flow (reveal gating, next phase resets, going back keeps the recorded answer). Suite is now 10 e2e + 24 unit, all green; typecheck and build clean.

**Notes for the Lead**
- BUILD-PLAN §3 "Objective + hypothesis screen" Must row can be ticked; §6 can add the four ids from D-031.
- The PLAR card also shows above the debrief, which fits its comms-blackout question.

**Next (Architect)** — unchanged: JSON import + compare; failure-hour marker on charts.

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
