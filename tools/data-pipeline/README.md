# NASA data pipeline (spec v2 §11.5)

Raw downloads go in `raw-data/` (git-ignored, GBs). Outputs go in `public/data/` (≤ 8 MB total, ≤ 2.5 MB gzipped).

| Step | Input | Output | Status |
|---|---|---|---|
| 1 LOLA terrain/slope | PGDA-78 `Site04/Site23/Haworth_*_5mpp_surf.tif`, `Haworth_slp.tif` | `public/data/lola-<site>-50m.json` (400×400) | ☐ waiting for organiser OK |
| 2 Diviner PRP | `dlre_prp_south.tab` | `public/data/diviner-psr-temperature.json` | ☐ |
| 3 JPL Horizons | API, 2028-01-01 → 2029-01-01, 1 h | `public/data/ephemeris-{earth-visibility,solar-azimuth}.json` | ☐ → then recalibrate D-003/D-004 |

Checks before deploy are listed in spec §11.7. Each data source gets one check against a published figure.
