#!/usr/bin/env python3
"""
Permanent-shadow close-ups for the map's ice layer (D-111).

Diviner cells (~350 m) are too coarse for the site close-ups (±1.5–5 km views), so each catalog site
gets a ±8 km mask from PGDA product 69 LPSR (Mazarico et al. 2011): permanently shadowed regions at
60 m/px, 85°S–90°S. Read without its label: 5058 × 5058 little-endian int16, 20000 = permanently
shadowed, -20000 = sunlit at some time; polar stereographic, pole at the grid centre (as AVGVISIB).

Output public/data/psr/sites.json:
  { source, tier, grids: [ { id, site, n, cx_km, cy_km, half_km, res_m, psr_b64 } ] }
psr_b64 = n*n uint8 (1 = permanently shadowed, 0 = not), row 0 = north (+y), column 0 = west (-x).

  python3 tools/data-pipeline/psr_grid.py raw-data/pgda69-illumination/LPSR_85S_060M_201608.IMG
"""
from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lola_crop import REPO, load_constants, site_xy_m  # noqa: E402

N, RES, PSR = 5058, 60.0, 20000
S0 = L0 = N / 2 - 0.5
HALF_KM, CELLS = 8.0, 256
OUT = REPO / "public" / "data" / "psr" / "sites.json"


def main() -> None:
    img = Path(sys.argv[1])
    a = np.memmap(img, "<i2", "r", shape=(N, N))
    c = load_constants()
    grids = []
    for sid in c["site_catalog"]:
        cx, cy = site_xy_m(c, sid)
        half = HALF_KM * 1000
        cell = 2 * half / CELLS
        idx = (np.arange(CELLS) + 0.5) * cell - half
        xs, ys = np.meshgrid(cx + idx, cy - idx)
        col = np.rint(xs / RES + S0).astype(np.int64)
        row = np.rint(L0 - ys / RES).astype(np.int64)
        ok = (col >= 0) & (col < N) & (row >= 0) & (row < N)
        mask = np.zeros((CELLS, CELLS), np.uint8)
        mask[ok] = (a[row[ok], col[ok]] == PSR).astype(np.uint8)
        grids.append({"id": f"{sid}_psr", "site": sid, "n": CELLS, "cx_km": round(cx / 1000, 4), "cy_km": round(cy / 1000, 4),
                      "half_km": HALF_KM, "res_m": round(cell, 3), "psr_b64": base64.b64encode(mask.tobytes()).decode("ascii")})
        print(f"{sid:18s} permanently shadowed: {mask.mean():.1%} of ±{HALF_KM:.0f} km")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": f"{img.name} (PGDA product 69, Mazarico et al. 2011, permanent shadow, 60 m)",
                               "tier": "nasa-data", "grids": grids}, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(REPO)}  {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
