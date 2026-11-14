# NASA data pipeline (spec v2 §11.5)

Raw downloads go in `raw-data/` (git-ignored, GBs). Outputs go in `public/data/` (≤ 8 MB total, ≤ 2.5 MB gzipped).

| Step | Input | Output | Status |
|---|---|---|---|
| 1a LOLA region | `LDEM_75S_120M.IMG` + `.LBL` (LOLA GDR) | `public/data/terrain/region.json` (512², ~350 m cells, ~0.7 MB) | ☐ script ready: `lola_crop.py region` |
| 1b LOLA sites | PGDA-78 `<Tile>_final_adj_5mpp_surf.tif` | `public/data/terrain/<site_id>.json` (256² over ±6 km, ~47 m cells, ~170 KB each) | ☐ script ready: `lola_crop.py site` |
| 2 Diviner PRP | `dlre_prp_south.tab` | `public/data/diviner-psr-temperature.json` | ☐ |
| 3 JPL Horizons | API, 2028-01-01 → 2029-01-01, 1 h | `public/data/ephemeris-{earth-visibility,solar-azimuth}.json` | ☐ → then recalibrate D-003/D-004 |

Checks before deploy are listed in spec §11.7. Each data source gets one check against a published figure.

## LOLA crop (`lola_crop.py`, D-106)

Needs only `numpy` and `Pillow`. Run from the repo root:

```bash
python3 tools/data-pipeline/lola_crop.py region raw-data/LDEM_75S_120M.LBL
python3 tools/data-pipeline/lola_crop.py info   raw-data/Site01_final_adj_5mpp_surf.tif   # which catalog sites fall inside
python3 tools/data-pipeline/lola_crop.py site   raw-data/Site01_final_adj_5mpp_surf.tif --site shackleton_ridge
```

PGDA-78 tile per catalog site (only the `_surf.tif` is needed; skip `Clones/`, `.xyzi` and the error maps):

| site_catalog id | PGDA-78 tile |
|---|---|
| `shackleton_ridge` | Site01 (Connecting ridge) |
| `de_gerlache_rim` | Site11 (de Gerlache rim) |
| `malapert_massif` | Site23 (Malapert massif) |
| `haworth_floor` | Haworth |
| `faustini_rim` | LM8 (Faustini Rim A) |

If `info` says the site is outside the tile, crop the tile's middle instead: `--center tile --id <site_id>`.
Output grids: int16 metres around `h_offset_m`, row 0 = north (+y), stereographic like `terrain.ts toXY()`.
