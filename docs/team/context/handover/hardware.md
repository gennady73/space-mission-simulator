# Handover — Hardware

Newest block on top. One block per session. Other roles write in their own files, never here (D-015, D-107).

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
