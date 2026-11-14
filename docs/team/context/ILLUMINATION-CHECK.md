# Site check against NASA data — for the Hardware review (D-109, D-110)

Prepared by the Lead from NASA data processed tonight. **Hardware decides** what changes in `site_catalog`; nothing here has been applied to the engine.

## 1. Sunlight and Earth view — PGDA product 69 (Mazarico et al.), 60 m/px, 18.6-year average, at the surface

Reproduce: `python3 tools/data-pipeline/illumination_check.py raw-data/pgda69-illumination`

| Site | Catalog lat, lon | Catalog sun / Earth | PGDA-69 at catalog point | Best-lit point within 2 km: sun / Earth (lat, lon, distance) |
|---|---|---|---|---|
| `shackleton_ridge` | -89.45, 222.7 | 92% / 62% | 0% / 0% | 88% / 58% (-89.475, 222.56, 0.8 km) |
| `de_gerlache_rim` | -88.5, 293.0 | 89% / 55% | 36% / 61% | 75% / 60% (-88.465, 292.15, 1.3 km) |
| `malapert_massif` | -86.0, 2.9 | 83% / 85% | 14% / 49% | 82% / 59% (-86.001, 2.06, 1.8 km) |
| `haworth_floor` | -87.4, 356.0 | 0% / 20% | 0% / 0% | 0% / 0% (-87.334, 356.11, 2.0 km) |
| `faustini_rim` | -86.6, 77.0 | 90% / 58% | 14% / 44% | 40% / 48% (-86.588, 76.95, 0.4 km) |

Reading it:
- At 60 m, a catalog point a few hundred metres off the crest lands in shadow (Shackleton ridge reads 0%). Use the **best-lit point** column: it is what a mission would pick.
- These are **surface** values. A mast top (VSAT 10 m and up) sees more sun; the catalog values may assume mast height — say so in provenance if kept.
- Clear gaps: **Faustini rim** (catalog 90% vs best 40% nearby; the brightest point on the whole Faustini rim within 26 km of the centre is 66% at -87.77, 94.66), **de Gerlache** (89% vs 75%), **Haworth Earth view** (catalog 20% vs 0% on the floor).
- Malapert Earth view: 85% catalog vs 59% at the best-lit point; the summit area reaches 100% Earth view.
- Note: the Lead moved `faustini_rim.latitude_deg` from -87.2 to -86.6 for the map (D-104); the original point also reads 0% / 0%.

## 2. Cold traps — Diviner polar resource product (DLRE PRP v2), ~350 m cells

Coldest Diviner point within the catalog cold-trap distance + 2 km (annual max / average temperature):

| Site | Diviner | Catalog |
|---|---|---|
| Shackleton ridge | 172 K / 65 K at 4.4 km | 38 K at 2.5 km |
| de Gerlache rim | 107 K / 58 K at 3.1 km, ice stable at the surface | 40 K at 3.2 km |
| Malapert massif | 158 K / 84 K at 1.3 km | 45 K at 6 km |
| Haworth floor | 50 K / 36 K | 38 K |
| Faustini rim | 120 K / 45 K at 2.9 km, ice stable at the surface | 41 K at 2 km |

Catalog cold-trap temperatures (38–45 K) match Diviner **average** temperatures inside large permanently shadowed craters; ice stays at the surface only where the **annual maximum** is below ~110 K (Paige et al. 2010). Cold pockets smaller than ~350 m are not resolved.

## Suggested options (Hardware's call)
1. Keep the game values, set their provenance tier to `game-rule` and cite this table as "simplified from".
2. Or move each site to its best-lit point and take sun / Earth / cold-trap values from the tables (changes game balance — note it in the PR).
