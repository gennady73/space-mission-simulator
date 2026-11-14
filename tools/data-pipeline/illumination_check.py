#!/usr/bin/env python3
"""
Cross-check the site catalog against PGDA product 69 (Mazarico et al.) average illumination and Earth
visibility, 85°S–90°S at 60 m/px (D-110). Prints a Markdown table for the Hardware review.

Inputs (raw-data/pgda69-illumination/, IMG without labels):
  AVGVISIB_85S_060M_201608.IMG        average fraction of the solar disc visible, 18.6-year average, at the surface
  AVGVISIB_85S_060M_201608_EARTH.IMG  same for Earth
Format as found (the .LBL files were not reachable): 5058 × 5058 little-endian int16, DN / 25000 = fraction
(max DN 25000 = always visible; the best-lit pixel near the Shackleton ridge reads 0.884, matching the
published ~89%), polar stereographic 60 m/px, pole at the grid centre (same convention as LDEM_75S_120M).

  python3 tools/data-pipeline/illumination_check.py raw-data/pgda69-illumination
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lola_crop import load_constants  # noqa: E402

N, RES, FULL = 5058, 60.0, 25000.0
S0 = L0 = N / 2 - 0.5


def main() -> None:
    folder = Path(sys.argv[1])
    c = load_constants()
    r_km = c["map_features"]["moon_radius_km"]
    sun = np.memmap(folder / "AVGVISIB_85S_060M_201608.IMG", "<i2", "r", shape=(N, N))
    ear = np.memmap(folder / "AVGVISIB_85S_060M_201608_EARTH.IMG", "<i2", "r", shape=(N, N))

    def ij(lat: float, lon: float) -> tuple[int, int]:
        rho = 2 * r_km * math.tan(math.radians(90 + lat) / 2) * 1000
        x, y = rho * math.sin(math.radians(lon)), rho * math.cos(math.radians(lon))
        return int(round(L0 - y / RES)), int(round(x / RES + S0))

    def latlon(i: int, j: int) -> tuple[float, float]:
        x, y = (j - S0) * RES, (L0 - i) * RES
        rho = math.hypot(x, y) / 1000
        return -90 + math.degrees(2 * math.atan(rho / (2 * r_km))), math.degrees(math.atan2(x, y)) % 360

    print("| Site | Catalog lat, lon | Catalog sun / Earth | PGDA-69 at catalog point | Best-lit point within 2 km: sun / Earth (lat, lon, distance) |")
    print("|---|---|---|---|---|")
    for sid, s in c["site_catalog"].items():
        i, j = ij(s["latitude_deg"], s["longitude_deg"])
        r = int(2000 / RES)
        w = sun[i - r:i + r + 1, j - r:j + r + 1].astype(np.int32)
        yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
        w = np.where(yy ** 2 + xx ** 2 <= r * r, w, -1)
        k = np.unravel_index(np.argmax(w), w.shape)
        bi, bj = i - r + k[0], j - r + k[1]
        la, lo = latlon(bi, bj)
        d = math.hypot(bi - i, bj - j) * RES / 1000
        print(f"| `{sid}` | {s['latitude_deg']}, {s['longitude_deg']} | {s['illumination_fraction']:.0%} / {s['earth_visibility_fraction']:.0%} "
              f"| {sun[i, j] / FULL:.0%} / {ear[i, j] / FULL:.0%} | {sun[bi, bj] / FULL:.0%} / {ear[bi, bj] / FULL:.0%} ({la:.3f}, {lo:.2f}, {d:.1f} km) |")


if __name__ == "__main__":
    main()
