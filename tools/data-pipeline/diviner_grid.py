#!/usr/bin/env python3
"""
Grid the Diviner south-polar resource product (DLRE PRP, Paige et al.) for the map (D-109).

Input:  raw-data/diviner/prp-south/dlre_prp_south.tab  (+ .lbl), 2.88 M triangles, fixed 210-byte rows:
        tri vertices xyz, tri_clon, tri_clat, tri_calt, temp_avg [K], temp_max [K], ice_depth [m, -999 = none]
Output: public/data/diviner/coldtraps.json  on the same polar stereographic box as terrain/region.json:
        { id, source, tier, n, cx_km, cy_km, half_km, res_m, nodata,
          tmax_k_b64   uint8 per cell: annual maximum temperature in K (255 = no data or >= 255 K),
          ice_cm_b64   uint8 per cell: depth to stable water ice in cm (0 = at the surface,
                       250 = 2.5 m or deeper, 254 = not stable at any depth, 255 = no data),
          sites: { <site_id>: { coldest_tmax_k, coldest_tavg_k, coldest_km, ice_surface_km } } }

Per-site numbers are a cross-check for the Hardware review (cold-trap temperature, distance);
they are not fed into the engine.

  python3 tools/data-pipeline/diviner_grid.py raw-data/diviner/prp-south/dlre_prp_south.tab
"""
from __future__ import annotations

import argparse
import base64
import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lola_crop import REPO, load_constants, region_box_m, site_xy_m  # noqa: E402

OUT = REPO / "public" / "data" / "diviner" / "coldtraps.json"
ROW = 210
NODATA = 255
ICE_NONE = 254
ICE_DEEP_CM = 250
# Search radius around a site for its coldest point: the catalog cold-trap distance plus this margin (km).
SITE_SEARCH_MARGIN_KM = 2.0


def read_columns(tab: Path) -> dict[str, np.ndarray]:
    raw = np.fromfile(tab, dtype=f"S{ROW}")
    header = raw[0].decode()
    names = [n.strip() for n in header.split(",")]
    rows = raw[1:]
    # fixed-width ASCII: find the comma positions from the first data row
    first = rows[0].decode()
    cuts = [-1] + [i for i, ch in enumerate(first) if ch == ","] + [len(first.rstrip("\r\n"))]
    want = {"tri_clon", "tri_clat", "temp_avg", "temp_max", "ice_depth"}
    b = rows.view(np.uint8).reshape(len(rows), ROW)
    out = {}
    for k, name in enumerate(names):
        if name not in want:
            continue
        s, e = cuts[k] + 1, cuts[k + 1]
        col = np.ascontiguousarray(b[:, s:e]).view(f"S{e - s}").ravel()
        out[name] = col.astype(np.float64)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("tab", type=Path)
    ap.add_argument("--n", type=int, default=512)
    ap.add_argument("--margin-km", type=float, default=18.0)
    a = ap.parse_args()

    c = load_constants()
    r_km = c["map_features"]["moon_radius_km"]
    cols = read_columns(a.tab)
    lat, lon = cols["tri_clat"], cols["tri_clon"]
    rho = 2 * r_km * np.tan(np.radians(90 + lat) / 2) * 1000
    x = rho * np.sin(np.radians(lon))
    y = rho * np.cos(np.radians(lon))
    tmax, tavg, ice = cols["temp_max"], cols["temp_avg"], cols["ice_depth"]
    print(f"{len(lat):,} triangles; lat {lat.min():.2f}..{lat.max():.2f}; "
          f"Tmax {np.nanmin(tmax[tmax > 0]):.1f}..{tmax.max():.1f} K")

    cx, cy, half = region_box_m(c, a.margin_km)
    n = a.n
    cell = 2 * half / n
    col = np.floor((x - (cx - half)) / cell).astype(np.int64)
    row = np.floor(((cy + half) - y) / cell).astype(np.int64)
    ok = (col >= 0) & (col < n) & (row >= 0) & (row < n) & (tmax > 0)
    idx = row[ok] * n + col[ok]
    cnt = np.bincount(idx, minlength=n * n)
    tsum = np.bincount(idx, weights=tmax[ok], minlength=n * n)
    has_ice = ice[ok] >= 0
    icnt = np.bincount(idx[has_ice], minlength=n * n)
    isum = np.bincount(idx[has_ice], weights=ice[ok][has_ice], minlength=n * n)
    with np.errstate(invalid="ignore", divide="ignore"):
        tmean = np.where(cnt > 0, tsum / cnt, np.nan)
        imean = np.where(icnt > 0, isum / icnt, np.nan)
    # fill empty cells (triangles are coarser than cells far from the pole) from the 8 neighbours
    tgrid = tmean.reshape(n, n)
    for _ in range(3):
        holes = np.isnan(tgrid)
        if not holes.any():
            break
        pad = np.pad(tgrid, 1, constant_values=np.nan)
        neigh = np.stack([pad[1 + dy:n + 1 + dy, 1 + dx:n + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)])
        with np.errstate(invalid="ignore"), __import__("warnings").catch_warnings():
            __import__("warnings").simplefilter("ignore", RuntimeWarning)  # all-NaN neighbourhoods stay NaN
            fill = np.nanmean(neigh, axis=0)
        tgrid = np.where(holes, fill, tgrid)
    covered = np.isfinite(tgrid)
    t_u8 = np.where(covered, np.clip(np.round(tgrid), 0, 254), NODATA).astype(np.uint8)
    # ice: majority "stable?" by count; depth = mean of stable cells
    iratio = np.where(cnt > 0, icnt / np.maximum(cnt, 1), 0).reshape(n, n)
    ig = imean.reshape(n, n)
    ice_u8 = np.full((n, n), NODATA, np.uint8)
    ice_u8[covered] = ICE_NONE
    stable = covered & (iratio >= 0.5) & np.isfinite(ig)
    ice_u8[stable] = np.clip(np.round(ig[stable] * 100), 0, ICE_DEEP_CM).astype(np.uint8)

    # per-site cross-check: coldest triangle within the catalog cold-trap distance + margin
    sites = {}
    for sid, s in c["site_catalog"].items():
        sx, sy = site_xy_m(c, sid)
        reach = (s["distance_to_cold_trap_km"] + SITE_SEARCH_MARGIN_KM) * 1000
        d = np.hypot(x - sx, y - sy)
        m = (d <= reach) & (tmax > 0)
        if not m.any():
            continue
        k = np.argmin(np.where(m, tmax, np.inf))
        surf = m & (ice >= 0) & (ice < 0.005)
        sites[sid] = {
            "coldest_tmax_k": round(float(tmax[k]), 1),
            "coldest_tavg_k": round(float(tavg[k]), 1),
            "coldest_km": round(float(d[k]) / 1000, 2),
            "coldest_xy_km": [round(float(x[k]) / 1000, 3), round(float(y[k]) / 1000, 3)],
            "ice_surface_km": round(float(d[surf].min()) / 1000, 2) if surf.any() else None,
            "catalog_cold_trap_k": s.get("ambient_cold_trap_temperature_k"),
            "catalog_distance_km": s["distance_to_cold_trap_km"],
        }

    doc = {
        "id": "diviner",
        "source": f"{a.tab.name} (LRO Diviner polar resource product, DLRE PRP v2, Paige et al.)",
        "tier": "nasa-data",
        "n": n, "cx_km": round(cx / 1000, 4), "cy_km": round(cy / 1000, 4), "half_km": round(half / 1000, 4),
        "res_m": round(cell, 3), "nodata": NODATA, "ice_none": ICE_NONE,
        "tmax_k_b64": base64.b64encode(t_u8.tobytes()).decode("ascii"),
        "ice_cm_b64": base64.b64encode(ice_u8.tobytes()).decode("ascii"),
        "sites": sites,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(REPO)}  {OUT.stat().st_size / 1024:.0f} KB  n={n}  cell={cell:.0f} m  "
          f"coverage={covered.mean():.0%}  cold cells (<110 K) {(t_u8 < 110).sum():,}  surface-ice cells {(ice_u8 == 0).sum():,}")
    print(json.dumps(sites, indent=1))


if __name__ == "__main__":
    main()
