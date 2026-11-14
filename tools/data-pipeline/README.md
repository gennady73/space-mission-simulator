# NASA data pipeline (spec v2 §11.5)

Raw downloads go in `raw-data/` (git-ignored, GBs). Outputs go in `public/data/` (≤ 8 MB total, ≤ 2.5 MB gzipped).

```
raw-data/
├── SOURCES.md                    local log: file, URL, date, size, sha256 (one row per download)
├── lola/
│   ├── gdr-polar-120m/           LDEM_75S_120M.IMG + .LBL           (LOLA GDR, imbrium.mit.edu)
│   └── pgda78-5m/<Tile>/         <Tile>_final_adj_5mpp_surf.tif     (PGDA product 78; Site01, Site11, Site23, Haworth, LM8)
├── diviner/prp-south/            dlre_prp_south.tab + .lbl          (Diviner polar resource product)
├── horizons/                     JPL Horizons API exports (Sun / Earth geometry per site)
└── pgda69-illumination/          optional: PGDA product 69 illumination maps
```

One folder per source, so each output's provenance names one folder. Keep file names exactly as published.

| Step | Input | Output | Status |
|---|---|---|---|
| 1a LOLA region + site close-ups | `LDEM_75S_120M.IMG` + `.LBL` (LOLA GDR) | `public/data/terrain/region.json` (512², ~350 m cells, 0.7 MB) + `<site>_120m.json` (±8 km, 62.5 m cells, σ 2 cells) | ✅ D-108 |
| 1b LOLA sites | PGDA-78 `<Tile>_final_adj_5mpp_surf.tif` (Site01, Site11, Site23) | `public/data/terrain/<site_id>_5m.json` (384² over ±4 km, ~21 m cells, 384 KB each; `--half-km 4 --n 384`). Haworth tile does not contain the floor site; Faustini has no tile → 120 m close-ups | ✅ |
| 2 Diviner PRP | `dlre_prp_south.tab` | `public/data/diviner-psr-temperature.json` | ☐ |
| 1b LOLA sites | PGDA-78 `<Tile>_final_adj_5mpp_surf.tif` | `public/data/terrain/<site_id>.json` (256² over ±6 km, ~47 m cells, ~170 KB each) | ☐ script ready: `lola_crop.py site` |
| 2 Diviner PRP | `raw-data/diviner/prp-south/dlre_prp_south.tab` | `public/data/diviner/coldtraps.json` (512², Tmax + ice depth, per-site cross-check): `diviner_grid.py` | ✅ D-109 |
| 3 JPL Horizons | API, 2028-01-01 → 2029-01-01, 1 h | `public/data/ephemeris-{earth-visibility,solar-azimuth}.json` | ☐ → then recalibrate D-003/D-004 |

Checks before deploy are listed in spec §11.7. Each data source gets one check against a published figure.

## LOLA crop (`lola_crop.py`, D-106)

Needs only `numpy` and `Pillow`. Run from the repo root:

```bash
python3 tools/data-pipeline/lola_crop.py region raw-data/lola/gdr-polar-120m/LDEM_75S_120M.LBL
python3 tools/data-pipeline/lola_crop.py info   raw-data/lola/pgda78-5m/Site01/Site01_final_adj_5mpp_surf.tif   # which catalog sites fall inside
python3 tools/data-pipeline/lola_crop.py site   raw-data/lola/pgda78-5m/Site01/Site01_final_adj_5mpp_surf.tif --site shackleton_ridge
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
Output grids: int16, `metres = value × h_scale_m + h_offset_m` (finest step ≥ 0.1 m that fits the relief), row 0 = north (+y), stereographic like `terrain.ts toXY()`. Each run also updates `public/data/terrain/index.json`; the map loads only the grids listed there (`src/ui/map/realTerrain.ts`), finest first, feathered into the coarser grid, schematic terrain outside. An empty index means schematic terrain everywhere.
