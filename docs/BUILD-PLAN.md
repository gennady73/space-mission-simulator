# Build Plan — adapting spec v2 for the build

**Status:** Active · **Owner:** Lead · **Created:** 2026-11-14 (Sat), NASA Space Apps, team eleven-two
**Baseline:** `docs/space-mission-simulator-implementation-specification-final-v2.md` (unchanged; this file records how the build departs from it and why)

Spec v2 is the game design. This plan makes it buildable in about 24 hours by two committers (Lead + Architect, each with their own Claude instance). It covers four things:

1. what the challenge asks for that the spec was missing;
2. what in the spec was inconsistent or wrong, and how the build corrects it;
3. what gets built first (Must / Should / Could);
4. who builds what, and the UI contract between the engine and the screens.

Every correction is logged with an ID in `docs/team/context/DECISIONS.md`.

---

## 1. Challenge coverage (NASA statement → where it is in the build)

| Challenge asks for | In spec v2? | Build answer |
|---|---|---|
| Working interactive game, clear UI | Yes (§1, §7) | Cockpit SPA |
| Mission configuration system | Yes (§6) | Hardware catalog in `engine-constants.json` |
| Resource management: mass, power, budget, data, comms, time | Partly | `ResourceLedger`: one always-visible bar covering all six resources |
| **Collaboration / up to 4 players** | **No** | **D-010: team mode.** Four seats, one per NASA segment. Each gate needs its owner's sign-off. Designs can also be shared by link or JSON (no server) |
| Simulation + evaluation | Yes (§3, §5) | `runMission()` (8,760 h) + `scoreMission()` |
| Feedback on *why* a mission fails | Yes (§5, §9) | Gate diagnostics + debrief fault tree |
| Mission objective defined before engineering | Implied (§8.1) | Objective + hypothesis screen before MCR |
| Launch vehicle mass/orbit check | Equation only | **SRR checks wet mass and fairing against the launcher** (D-012) |
| Several orbit options | Only a file name | **Direct vs Ballistic Lunar Transfer** (`trajectories`) |
| Difficulty levels / scenarios | No | **D-011:** Cadet / Engineer / Flight Director |
| Every decision has a consequence; no single best answer | Yes | Verified: 5 different designs pass (see §4) |
| Save / share / compare | REQ-007 | `exportDesign`, `importDesign`, `#design=` share link |
| Random events | No | **D-009:** seeded dust events, cable snags, rover failure |

## 2. Spec v2 errata (fixed in the build, kept out of the baseline)

| # | Spec v2 says | Problem | Build does | ID |
|---|---|---|---|---|
| 1 | `P_gen = P_rated · sin(α)` | With α ≤ 1.8°, a 10 kW mast would give at most ~310 W. Vertical panels face a horizon Sun, so the factor is cos α ≈ 1 | `P_rated · cos α · η_dust` when α ≥ mast cutoff, else 0 | D-002 |
| 2 | Solar elevation swings −1.5° to +1.8°, while the 10 m mast cuts off at 1.2° and the 3 m mast at 3.5° | The 3 m mast would never generate. Eclipse length did not follow from the model | Per-site synthetic model `α = μ_site + 1.54°·sin(2πt/T_syn)`, with μ tuned so the 10 m mast's longest shadow equals the site's shadow. Replaced by JPL Horizons data when the pipeline is ready | D-003 |
| 3 | `θ_Earth = θ_site_latitude + 6.7°·sin(…)` | Latitude is about −89°, so Earth would never be visible | `θ_Earth = μ_earth,site + 6.7°·sin(2πt/655.7 h)`; line of sight when ≥ 0.5° | D-004 |
| 4 | PDR uses one fixed 54 h shadow and a fixed base load | Ignores the mast choice and the design's own loads. The 3 m mast passed PDR, then browned out on day 16 | PDR uses the longest shadow for the **selected mast at the selected site**, × the design's **own survival load** | D-005 |
| 5 | E2E comment: "4 kWh … demands 5.74 kWh for 20% margin" | 5.74 kWh is the **zero**-margin minimum | New quest `quest_pdr_margin` teaches the margin (15% → 6,598 Wh, see #14). A 6 kWh pack "looks enough" but fails PDR | D-005 |
| 6 | Plume quest: "bare regolith 1,200 m"; catalog bowl = 1,800 m; fault tree "< 1200 m" | Three different baselines | The catalog is authoritative (bowl 1,800 / sintered 1,200 / elevated 600). Quest baseline = sintered pad. Fault tree reads the pad's own value | D-006 |
| 7 | E2E test 1 passes SRR at 1,500 m with no pad chosen; test 3 expects "Cislunar Freight Trail" | No default pad; that text appears nowhere else | Test 1 picks the sintered pad; test 3 expects the real fallback badge | D-007 |
| 8 | Laser "22% DC-to-DC" with no transmitter power | Delivered power cannot be computed | `source_power_w: 1000`, `efficiency: 0.22`, dust transmittance 0.90 → 198 W ≥ 175 W drill | D-008 |
| 9 | ICD references 10 types it never defines | Will not compile | All defined in `src/models/Interfaces.ts` | D-019 |
| 10 | `boltzmann_constant_w_m2_k4` | That is the Stefan–Boltzmann constant σ | Renamed `stefan_boltzmann_w_m2_k4` | D-019 |
| 11 | Data paths `assets/data/…` vs `public/config/…` (Drive guide) | Two homes for one contract | Vite convention: `public/config/engine-constants.json`, `public/data/*.json`, `public/assets/…` | D-001 |
| 12 | Buffer quest: 14 h Earth-out | The year-long model has Earth-out spells of ~10 days (libration) | Quest kept as a self-contained exercise; its explanation now says the real buffer must be bigger, or use a relay. Storage is a catalog choice (32/128/512 Gbit) | D-013 |
| 13 | MCR thresholds hard-coded (10°, 50%) | Breaks REQ-003 | Moved to `simulation.max_touchdown_slope_deg` and `min_earth_visibility_fraction` | D-019 |
| 14 | PDR margin "GSFC-STD-1000 Rule 1.05", 20% for power and mass | Rule 1.05 is Single Point Failures. Rule 1.06 (Resource Margins) requires > 15% power and > 10% dry mass at PDR; 20% is the SRR value | `minimum_power_margin_pdr` 0.15 and `minimum_mass_margin_pdr` 0.10; gate banner cites Rule 1.06 | D-021 |
| 15 | "STMD SF02 / Need 2.02 (Surface Utility Transmission)" | Need 2.02 is low-power thermal/actuation | Power delivery cites Need 2.04 (power management & distribution) | D-022 |

**Verified 2026-11-14 (V-01):** the GSFC-STD-1000 margins (errata #14) and the STMD shortfall IDs, ranks and need numbers (#15) were checked against the documents; `provenance` cites pages.

## 3. Scope — Must / Should / Could

The event ends Sunday 15 Nov. **Cut line: Sunday 12:00.** After that, nothing new, only fixes and the presentation.

| Pri | Item | Owner | Est. |
|---|---|---|---|
| **Must** | Engine core: constants loader, gates, 8,760 h run, score ✅ *done in bootstrap commit* | Lead (handed to Arch) | — |
| **Must** | Cockpit layout: phase tracker, resource bar (6 resources), choice cards per phase, gate result banner, Next Phase | Architect | 4 h |
| **Must** | Objective + hypothesis screen (Feynman "questions first", §8.1) | Architect / Media | 1 h |
| **Must** | Run + debrief: telemetry strip charts (SoC, power, buffer), event list, fault-tree text, score, badges | Architect | 3 h |
| **Must** | "About & Numbers" page: renders `provenance` + data credits + AI-use declaration (design guide §4) ✅ *`#about`, D-023* | Lead | 1.5 h |
| **Must** | GitHub Pages deploy + README + submission text + demo video | Lead | 2 h |
| **Should** | Side-quest modals (5 quests, inline answer check) | Lead | 1.5 h |
| **Should** | Team mode: role picker, hot-seat, per-gate sign-off | Architect | 2 h |
| **Should** | Difficulty selector; share link / JSON export–import / compare two designs | Architect | 1.5 h |
| **Should** | 2D site map from LOLA (Canvas): relief + slope layer gated by NDL | Architect + data | 4 h |
| **Could** | Diviner ice heatmap layer (gated by the neutron spectrometer) | data | 2 h |
| **Could** | Horizons ephemeris replacing the synthetic Sun/Earth model | Lead | 3 h |
| **Could** | Orbit view (schematic Direct vs BLT) | Architect | 1 h |
| **Could** | Three.js mast/pad models | Media | — (cut first) |

## 4. Verified behaviour of the bootstrap constants (Engineer level, seed 20261114)

> Values below were measured with the bootstrap 20% margins. After D-021 (15% power, 10% mass) every gate outcome is the same except Malapert + laser, which now fails CDR on laser range; wet masses are ~290 kg lower (reference 3,170 kg).

| Design (changes vs reference) | First gate failure | Wet mass / LV | Cost | Run | Score |
|---|---|---|---|---|---|
| **Reference** (Shackleton, elevated pad 800 m, 10 m mast, 8 kWh, X-band, 128 Gbit, maglev, laser) | — | 3,458 / 4,500 kg | $242.5M | 8,760 h, 4,056 kg ice | **816** |
| Sintered pad at 1,500 m | — | 3,079 | $236.5M | full year | 824 |
| Relay + 32 Gbit | — | 3,425 | $248.0M | full year, 0% data lost | 809 |
| 20 m mast + 4 kWh | — | 3,877 | $253.5M | full year | 801 |
| de Gerlache + rover + 25 kWh fuel cell + cable | — | 4,465 | $256.2M | full year | 796 |
| 32 Gbit, direct-to-Earth only | — | | | 26% of science lost | 792 |
| 6 kWh battery | PDR (−5% margin) | | | survives (15% min SoC). Why margins exist | 698 |
| 4 kWh battery | PDR | | | brownout h 548 | 306 |
| 3 m mast | PDR (long shadows) | | | brownout h 379 | 318 |
| Haworth floor | MCR radio | | | | 118 |
| Faustini rim | MCR slope 12.3° | | | | 579 |
| Natural bowl at 800 m | SRR plume | | | | 653 |
| Rideshare lander | SRR mass | 3,458 / 1,200 | | | 676 |
| Malapert (cold trap 6 km away) | SRR mass on the medium launcher; over budget on heavy | 5,399 | $355.5M | | 679 |
| Drill heater 20 W | CDR freeze | | | 0 kg ice | 417 |

Several different designs win, and every trap fails at the gate that names its cause. That is the core teaching loop.

## 5. Scoring (game rule)

`total (0–1000) = 300·gates/5 + 400·min(1, S_score)·(Σ instrument science value / max) + 200·budget efficiency + 100·data completeness`

- `S_score` is from spec §3.4.
- Budget efficiency = share of budget left × 2, capped at 1.
- Badges follow the spec §9.2 shortfalls (conditions are in `shortfall_badges`).

## 6. Engine ↔ UI contract (for the cockpit)

The engine is pure, and the UI calls it:

- `loadConstants()`
- `resolveDesign(c, state)` returns either a design or `{missing}` (use `missing` for "what's left to choose")
- `computeLedger()` feeds the resource bar
- `runDesignGates()` / `validateMCR…CDR` returns `GateValidationResult`, shown in `.gate-error-banner` or a pass banner
- `runMission()` returns telemetry plus events
- `scoreMission()`

DOM ids used by the E2E tests (keep them stable):

- `#btn-next-phase`
- `#current-phase-display`, with text like `Phase B: Preliminary Design Review (PDR)`
- `#btn-site-<siteId>`, `#btn-pad-<padId>`, `#btn-battery-<batteryId>`; in general `#btn-<category>-<catalogId>`
- `#input-pad-distance`
- `.gate-error-banner`
- `[data-placeholder-id]`, `.fallback-frame`, `.fallback-badge`
- `#btn-run-reference`, `#reference-output` (build shell; may be moved to a dev menu)

## 7. Data pipeline (spec §11)

The NASA data request to the organisers is in spec §11. Raw files go in `raw-data/` (git-ignored). Processed JSON goes in `public/data/` (budget 8 MB). Scripts live in `tools/data-pipeline/`. Until the data lands, the game runs entirely on the synthetic site model; the map shows a schematic.
