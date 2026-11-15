# Hardware review — engine-constants.json

**Role:** Hardware (Mechanic) · **Date:** 2026-11-15 · **Branch:** `hw/review-engine-constants` · **Decisions:** D-201 … D-212 (numbered as cited in the Lead's D-119)

**Rule followed:** a value changes only where a source I can show says so and the change does not contradict a Lead decision or what the engine flies. This PR changes **two values** (VIPER rover mass and slope, D-210, from a NASA document; 144 runs identical before and after) and otherwise adds or corrects provenance. `npm run typecheck`, `npm test` and `npm run build` pass.

---

## 1. Status of every finding

| ID | Finding | Outcome |
|---|---|---|
| D-201 | TRIDENT mass 25 kg had no source ("team estimate") | **Confirmed:** Zacny et al., LPSC 2021 #2400: drill 20 kg + avionics 5.4 kg = 25.4 kg without harness. Provenance added (literature). An earlier 16 kg reading from a secondary summary was wrong |
| D-202 | Laser 198 W in dust vs drill 175 W + heater 35 W | **Resolved by Lead D-119:** the heater is thermostatic and off while the motor runs; demand is the larger, not the sum. No change |
| D-203 | Shackleton sun 92.4 % vs PGDA-69 88 % (surface, best-lit point) | Kept as a balanced game value; covered by the Lead's `site_catalog` provenance |
| D-204 | Shackleton `solar_elevation_mean_deg` 2.696° vs 2.09° flat-horizon max | **Resolved by Lead D-119:** effective elevation over the ridge's lowered horizon, tuned for ~54 h darkness; Horizons after the event |
| D-205 | Cold-trap distances (Shackleton 2.5 km, Malapert 6 km) vs nearest Diviner points (4.4 km / 1.3 km, both too warm for surface ice) | Kept; no clean measured value. Cold-trap temperatures 38–45 K kept on purpose (Lead's provenance: they match Diviner averages inside large PSRs) |
| D-206 | Haworth latitude −87.4° (secondary source says 86.9° S) | **Open, not applied:** check https://planetarynames.wr.usgs.gov ("Haworth"). Map only (Lead's area) |
| D-207 | Faustini sun 90 % vs PGDA-69 40 % | **Resolved by Lead D-119:** measured values applied (0.40 / 0.48) |
| D-208 | Game rules presented as sourced values | **Fixed in this PR** (table §2) |
| D-209 | `#about` showed per-km mass/cost of maglev and cable as totals | **Fixed by Lead in PR #38** |
| D-210 | VIPER rover mass 430 kg and max slope 14.5° had no source | **Fixed in this PR:** 447 kg and 15° from NASA NTRS 20240013903 (Bluethmann 2024, slides 2 and 4). No gate outcome changes (no route slope lies between 14.5° and 15°) |
| D-212 | Touchdown slope limit 10° and Earth-visibility threshold 50 % had spec-only sources | **Sourced in this PR:** 10° confirmed by NASA's Artemis III landing requirements (Artemis HLS Overview, Space Apps 2025, slides 21 and 23). The 50 % Earth threshold stays a game rule, now noted as stricter than NASA's 25 % exclusion (slide 25) |
| D-211 | Rover is named "Skid-steer" | **Proposal (player text, Media/Lead):** VIPER has four explicitly steered wheels (±50°) and drives omni-directionally (same document, slides 4–5). Suggest "Four-wheel steered rover (VIPER heritage)". Not applied |

## 2. Provenance corrected in this PR (values unchanged)

| Value | Now cited as |
|---|---|
| TRIDENT mass 25 kg | **literature**: Zacny et al., LPSC 2021 #2400 |
| 10 m VSAT mast 10 kW | **nasa-doc**: TechPort 116305, 10 kW goal |
| 3 m (2.5 kW) and 20 m (12.5 kW) mast power | game-rule (team scaling; no published value) |
| Mast cutoff angles 3.5° / 1.2° / 0.5° | game-rule (no published source; not TechPort 116305) |
| Laser efficiency 22 % | literature: inside the published ~10 % (end-to-end) to >40 % (receiver only) range; no single document gives 22 % |
| Pad standoff 1,800 / 1,200 / 600 m | game-rule (NASA 2011 2 km heritage keep-out is not a measured safe distance) |
| TRIDENT 175 W and 120 kbps | spec-provisional (not in LPSC 2021 #2400 or other open documents found) |
| VIPER rover mass 447 kg, slope 15° | **nasa-doc**: NTRS 20240013903, slides 2 and 4 (values changed, D-210) |
| Touchdown slope limit 10° | **nasa-doc**: Artemis III landing requirement < 10° (Artemis HLS Overview, Space Apps 2025, slide 21) |
| Minimum Earth visibility 50 % | game-rule, stricter than NASA's 25 % exclusion (same deck, slide 25) |
| VIPER rover survival heater 45 W | spec-provisional (the NASA deck gives 50 h low-power survival on 5,420 Wh, no heater wattage) |
| Ice assay 0.5 kg/h | game-rule (TRIDENT is a sampling drill; no published harvest rate) |

Li-ion packs (148–151 Wh/kg, consistent across all four) are OK as already cited.

## 3. Still unverified (about 170 provisional numbers)

Not wrong, just labelled provisional or game-rule honestly. Next to check against public sources: lander Isp (320 s); X-band / S-band rates; VSAT 10 m mast mass (320 kg); maglev values (NASA NIAC FLOAT concept); launch vehicle capacities. Costs are team estimates and say so.

Note from the same VIPER deck: VIPER's X-band direct-to-Earth link tops out at 8 Msps; the game's lander X-band is 50 Mbps. Not directly comparable (bigger lander antenna and power are plausible), but worth a source.

## 4. Design sanity runs (Engineer, seed 20261114, before D-119)

| Design | First failing gate | Score | Ice kg | Uptime h |
|---|---|---|---|---|
| Reference (Shackleton, 10 m mast, 8 kWh, maglev, laser) | — | 816 | 4,055.5 | 8,760 |
| Sintered pad at 1,500 m | — | 824 | 4,055.5 | 8,760 |
| Relay + 32 Gbit | — | 809 | 4,055.5 | 8,760 |
| 20 m mast + 4 kWh | — | 801 | 4,380 | 8,760 |
| de Gerlache + rover + 25 kWh fuel cell + cable | — | 796 | 3,899.5 | 8,760 |
| 6 kWh battery | PDR margin | 698 | 4,049.5 | 8,760 |
| 4 kWh battery | PDR margin | 306 | 252.5 | 548 |
| 3 m mast | PDR margin | 318 | 115 | 379 |
| Haworth floor | MCR radio | 118 | 0 | 86 |
| Faustini rim | MCR slope | 579 | 3,941 | 8,760 |
| Natural bowl at 800 m | SRR plume | 653 | 4,055.5 | 8,760 |
| Rideshare lander | SRR mass | 676 | 4,055.5 | 8,760 |
| Malapert | PDR margin | 279 | 236 | 558 |
| Drill heater 20 W | CDR freeze | 417 | 0 | 8,760 |

All five sites lie within 6° of the pole, as Artemis III requires (same deck, slide 21). Every trap fails at the gate that names its cause (matches BUILD-PLAN §4). Physically odd but intended as game rules: ~4,000 kg of ice a year from one sampling drill (score unit); Faustini, if forced past MCR, flies the old ~90 % sun model.

## 5. Side-quests recomputed by hand — all correct

| Quest | Calculation | Result |
|---|---|---|
| Battery sizing | 85 W × 54 h ÷ 0.80 | 5,737.5 Wh ✅ |
| PDR margin | 85 × 54 × 1.15 ÷ 0.80 | 6,598.1 Wh ✅ |
| Data buffer | 120,000 bps × 50,400 s ÷ 10⁶ | 6,048 Mb ✅ |
| Optical beaming | 1,000 × 0.22 × 0.90 | 198 W ✅ |
| Plume deflector | 1,200 × (1 − 0.50) | 600 m ✅ |
