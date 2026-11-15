# Handover — Hardware

Newest block on top. One block per session. Other roles write in their own files, never here (D-015, D-107).

---

## 2026-11-15 ~17:00 IST · Hardware (Gabriel, with Claude) · number review — comms, mast, instruments, maglev, launch vehicles
**Did** (branch `hw/review-engine-constants`, provenance only, no value changes — web search blocked in this org; sources from training knowledge + NASA pages accessible via WebFetch)
- D-215: `dte_xband.downlink_kbps` 50 Mbps — spec v2 §3.3 baseline; physically achievable with 60 W + ~0.5 m HGA + DSN 70 m (cf. LRO 100 Mbps); VIPER does ~8 Mbps with smaller hw. Stays spec-provisional. `dte_sband_lowgain.downlink_kbps` 2 Mbps — optimistic for true low-gain DTE omni (typical 10–100 kbps); labelled game-rule.
- D-216: `mast_10m_vsat.mass_kg` 320 kg — TechPort 116305 gives 10 kW power (nasa-doc) but no mass. 320 kg is team estimate; labelled game-rule.
- D-217: NDL 15 kg — LaRC NDL-M ~2–4 kg (miniaturised), ALHAT era ~25 kg; 15 kg is full package estimate, game-rule. Neutron spec+radiometer 14 kg — NSNS ~1.6 kg, LEND ~7 kg; 14 kg in plausible range, game-rule. Mass spec 7 kg — MSolo ~2.5 kg, MASPEX ~8.1 kg; 7 kg in range, game-rule.
- D-218: Launch vehicle capacities — section-level provenance already adequate (game-rule); lv_heavy 15,000 kg consistent with Falcon Heavy TLI range; fine-grained note added.
- D-219: FLOAT maglev values (110 kg/km, 28°, 0.998) — NASA NIAC Phase I 2021 overview gives payload/throughput but no mass/km or slope figure in accessible documents; all three labelled game-rule.
- Cloud clone: committed as `hw(D-215–D-219): comms, mast, instrument, maglev provenance`.
- **43/43 tests pass. typecheck clean.**

**Still outstanding on this branch** — HW-REVIEW §3 is complete. D-206 (Haworth latitude check, map area, Lead) still open. Next: `git push` from device and update PR description.

**Next (Hardware)** — HW-REVIEW complete. D-206 delegated to Lead. No further open items for Hardware on this branch.

---

## 2026-11-15 ~15:30 IST · Hardware (Gabriel, with Claude) · number review — descent delta-v
**Did** (branch `hw/review-engine-constants`, provenance only, no value changes)
- D-214: `trajectories.direct.descent_delta_v_m_s` 1,850 m/s — spec v2 §3.1; no open NASA document among sources given; physically consistent with LLO-to-surface descent; stays spec-provisional. `trajectories.ballistic_lunar_transfer.descent_delta_v_m_s` 1,730 m/s — team estimate relabelled game-rule. Section-level key updated to note fine-grained split.

**Next (Hardware)** — X-band (50 Mbps) and S-band (2 Mbps) comms rates; VSAT 10 m mast mass (320 kg); maglev values; launch vehicle capacities; other instrument masses.

---

## 2026-11-15 ~15:00 IST · Hardware (Gabriel, with Claude) · number review — lander Isp
**Did** (branch `hw/review-engine-constants`, provenance only, no value changes)
- D-213: lander `isp_s` 320 s — no open CLPS-class document found among sources given; value is consistent with hypergolic vacuum Isp; provenance stays game-rule, physical context added in a new fine-grained provenance key alongside the existing section key.

**Next (Hardware)** — descent delta-v (1,850 m/s); X-band / S-band comms rates; VSAT 10 m mast mass (320 kg); maglev values; launch vehicle capacities; other instrument masses.

---

## 2026-11-15 ~13:30 IST · Hardware (Gabriel, with Claude) · number review
**Did** (one PR, branch `hw/review-engine-constants`, provenance only, no value changes)
- Full review in `docs/team/context/HW-REVIEW.md`: key figures, 5 sites, design runs, side-quests.
- D-201: TRIDENT mass 25 kg confirmed with a source (LPSC 2021 #2400: 20 + 5.4 kg).
- D-208: provenance tiers corrected so game rules no longer read as NASA values.
- D-212: touchdown slope limit 10° confirmed by NASA Artemis III requirements.
- D-210: VIPER rover mass 447 kg and max slope 15° from NASA NTRS 20240013903 (no gate outcome changes).
- D-202, D-204, D-207 closed by the Lead's D-119; D-209 (#about per km) fixed in PR #38.

**Open for the Lead** — D-206 Haworth latitude (verify IAU); D-211 rover name "Skid-steer" (VIPER steers all four wheels).

**Next (Hardware)** — verify the remaining provisional numbers one by one (Isp, comms next); Horizons recalibration after the event.

---
