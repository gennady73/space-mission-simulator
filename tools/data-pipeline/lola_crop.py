#!/usr/bin/env python3
"""
Crop LOLA south-pole elevation into small height grids the map can load (D-106).

Needs only numpy and Pillow (no GDAL). Reads two kinds of input:

  * PDS3 polar grid, e.g. LDEM_75S_120M.IMG + .LBL (LOLA GDR, 120 m/px) -> one regional grid
  * PGDA product 78 site GeoTIFF, e.g. Site01_final_adj_5mpp_surf.tif (5 m/px) -> one grid per site

Writes public/data/terrain/<name>.json:

  { "id", "source", "tier", "res_m", "n", "cx_km", "cy_km", "half_km",
    "h_offset_m", "nodata", "heights_b64" }

heights_b64 = n*n little-endian int16; height_m = value * h_scale_m + h_offset_m; row 0 = north edge (top of
the map, +y), column 0 = west edge (-x). Coordinates are south polar stereographic, the same
convention as src/ui/map/terrain.ts toXY(): x = rho*sin(lon), y = rho*cos(lon), 0 deg E up.
Cells outside the source are `nodata`.

Examples (run from the repo root):

  # region from the 120 m grid, centred on the sites, 512 x 512
  python3 tools/data-pipeline/lola_crop.py region raw-data/LDEM_75S_120M.LBL --n 512

  # one site from a 5 m PGDA tile, 256 x 256 cells over +-6 km around the catalog site
  python3 tools/data-pipeline/lola_crop.py site raw-data/Site01_final_adj_5mpp_surf.tif --site shackleton_ridge

  # inspect a file without writing anything
  python3 tools/data-pipeline/lola_crop.py info raw-data/Site23_final_adj_5mpp_surf.tif
"""
from __future__ import annotations

import argparse
import base64
import json
import math
import re
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
CONSTANTS = REPO / "public" / "config" / "engine-constants.json"
OUT_DIR = REPO / "public" / "data" / "terrain"
NODATA = -32768


# ---- sources ----------------------------------------------------------------------------------
class Source:
    """A height raster with a mapping pixel (row, col) <-> polar stereographic metres."""

    name: str
    res_m: float
    data: np.ndarray  # metres, float32, NaN = no data
    x0_m: float  # x of the centre of column 0
    y0_m: float  # y of the centre of row 0 (rows go south, i.e. -y)

    def sample(self, xs_m: np.ndarray, ys_m: np.ndarray) -> np.ndarray:
        """Bilinear sample at stereographic points; NaN outside."""
        c = (xs_m - self.x0_m) / self.res_m
        r = (self.y0_m - ys_m) / self.res_m
        h, w = self.data.shape
        c0 = np.floor(c).astype(np.int64)
        r0 = np.floor(r).astype(np.int64)
        fc = c - c0
        fr = r - r0
        ok = (c0 >= 0) & (r0 >= 0) & (c0 + 1 < w) & (r0 + 1 < h)
        c0c = np.clip(c0, 0, w - 2)
        r0c = np.clip(r0, 0, h - 2)
        d = self.data
        v = (d[r0c, c0c] * (1 - fc) * (1 - fr) + d[r0c, c0c + 1] * fc * (1 - fr)
             + d[r0c + 1, c0c] * (1 - fc) * fr + d[r0c + 1, c0c + 1] * fc * fr)
        return np.where(ok, v, np.nan)

    def block_mean(self, cx_m: float, cy_m: float, half_m: float, n: int) -> np.ndarray:
        """n x n grid of cell means (box filter) when cells are much larger than source pixels."""
        cell = 2 * half_m / n
        k = max(1, int(round(cell / self.res_m)))
        if k == 1:
            idx = (np.arange(n) + 0.5) * cell - half_m
            xs, ys = np.meshgrid(cx_m + idx, cy_m - idx)
            return self.sample(xs, ys)
        # average k x k sub-samples per cell (cheap anti-aliasing without scipy)
        sub = (np.arange(n * k) + 0.5) * (cell / k) - half_m
        out = np.zeros((n, n), dtype=np.float64)
        cnt = np.zeros((n, n), dtype=np.float64)
        for i0 in range(0, n * k, k * 32):  # strips keep memory low
            rows = sub[i0:i0 + k * 32]
            xs, ys = np.meshgrid(cx_m + sub, cy_m - rows)
            v = self.sample(xs, ys).reshape(len(rows) // k, k, n, k)
            good = ~np.isnan(v)
            out[i0 // k:i0 // k + v.shape[0]] = np.where(good, v, 0).sum(axis=(1, 3))
            cnt[i0 // k:i0 // k + v.shape[0]] = good.sum(axis=(1, 3))
        with np.errstate(invalid="ignore"):
            return np.where(cnt > 0, out / np.maximum(cnt, 1), np.nan)


def _lbl_value(text: str, key: str) -> str:
    m = re.search(rf"^\s*{key}\s*=\s*(.+?)\s*$", text, re.M)
    if not m:
        raise ValueError(f"{key} not in label")
    return m.group(1).strip().strip('"')


def _num(s: str) -> float:
    return float(re.match(r"[-+0-9.eE]+", s).group(0))


class PdsGrid(Source):
    """LOLA GDR polar IMG with detached PDS3 label."""

    def __init__(self, lbl: Path):
        text = lbl.read_text(errors="replace")
        img_name = re.search(r'\^IMAGE\s*=\s*"?([^"\s,)]+)', text)
        img = lbl.with_name(img_name.group(1)) if img_name else lbl.with_suffix(".IMG")
        if not img.exists():
            for cand in (lbl.with_suffix(".IMG"), lbl.with_suffix(".img")):
                if cand.exists():
                    img = cand
        lines = int(_num(_lbl_value(text, "LINES")))
        samples = int(_num(_lbl_value(text, "LINE_SAMPLES")))
        bits = int(_num(_lbl_value(text, "SAMPLE_BITS")))
        stype = _lbl_value(text, "SAMPLE_TYPE")
        scale = _num(_lbl_value(text, "SCALING_FACTOR"))
        offset = _num(_lbl_value(text, "OFFSET"))
        map_scale = _lbl_value(text, "MAP_SCALE")
        res_m = _num(map_scale) * (1000.0 if "KM" in map_scale.upper() else 1.0)
        l0 = _num(_lbl_value(text, "LINE_PROJECTION_OFFSET"))
        s0 = _num(_lbl_value(text, "SAMPLE_PROJECTION_OFFSET"))
        radius = _lbl_value(text, "A_AXIS_RADIUS")
        r_m = _num(radius) * (1000.0 if _num(radius) < 1e5 else 1.0)
        endian = "<" if ("LSB" in stype or "PC" in stype) else ">"
        dt = np.dtype(f"{endian}{'i' if 'INTEGER' in stype and 'UNSIGNED' not in stype else 'u'}{bits // 8}")
        if "REAL" in stype:
            dt = np.dtype(f"{endian}f{bits // 8}")
        raw = np.memmap(img, dtype=dt, mode="r", shape=(lines, samples))
        self.name = img.name
        self.res_m = res_m
        # heights relative to the reference sphere, metres (OFFSET is the radius in km or m)
        off_m = offset * (1000.0 if offset < 1e5 else 1.0)
        self._raw, self._scale, self._off = raw, scale, off_m - r_m
        # PDS: x = (sample - S0) * res, y = (L0 - line) * res, samples/lines 1-based
        self.x0_m = (1 - s0) * res_m
        self.y0_m = (l0 - 1) * res_m
        self.data = _LazyScaled(raw, scale * (1000.0 if scale < 0.01 else 1.0), self._off)
        self.meta = dict(lines=lines, samples=samples, res_m=res_m, type=str(dt), scale=scale, offset=offset,
                         line_proj_offset=l0, sample_proj_offset=s0, radius_m=r_m)


class _LazyScaled:
    """Index a memmap and convert to metres only for the pixels touched."""

    def __init__(self, raw, scale, off):
        self.raw, self.scale, self.off = raw, scale, off
        self.shape = raw.shape

    def __getitem__(self, key):
        return self.raw[key].astype(np.float32) * self.scale + self.off


class GeoTiff(Source):
    """Single-band float GeoTIFF in polar stereographic metres (PGDA product 78)."""

    def __init__(self, path: Path):
        from PIL import Image
        Image.MAX_IMAGE_PIXELS = None
        im = Image.open(path)
        tags = im.tag_v2
        scale = tags.get(33550)  # ModelPixelScale (sx, sy, sz)
        tie = tags.get(33922)  # ModelTiepoint (i, j, k, X, Y, Z)
        if not scale or not tie:
            raise ValueError("no GeoTIFF georeferencing tags (33550/33922)")
        geokeys = tags.get(34735) or ()
        pixel_is_point = _geokey(geokeys, 1025) == 2  # GTRasterTypeGeoKey: 1 = area, 2 = point
        sx, sy = float(scale[0]), float(scale[1])
        i, j, X, Y = float(tie[0]), float(tie[1]), float(tie[3]), float(tie[4])
        nodata = tags.get(42113)
        a = np.asarray(im, dtype=np.float32)
        if a.ndim == 3:
            a = a[..., 0]
        if nodata is not None:
            try:
                a = np.where(a == float(str(nodata).strip("\x00 ")), np.nan, a)
            except ValueError:
                pass
        a = np.where(np.abs(a) > 1e20, np.nan, a)
        finite = a[np.isfinite(a)]
        span = float(finite.max() - finite.min()) if finite.size else 0.0
        self.units = "km" if span < 30 else "m"  # 5 m site tiles span km of relief; values < 30 => km
        if self.units == "km":
            a = a * 1000.0
        half = 0.0 if pixel_is_point else 0.5
        self.name = path.name
        self.res_m = sx
        self.data = a
        self.x0_m = X + (0 - i + half) * sx
        self.y0_m = Y - (0 - j + half) * sy
        if abs(sx - sy) > 1e-6:
            print(f"warning: non-square pixels {sx} x {sy}", file=sys.stderr)
        self.meta = dict(shape=a.shape, res_m=sx, units_in_file=self.units, pixel_is_point=pixel_is_point,
                         x_range_km=(self.x0_m / 1000, (self.x0_m + a.shape[1] * sx) / 1000),
                         y_range_km=((self.y0_m - a.shape[0] * sy) / 1000, self.y0_m / 1000),
                         h_range_m=(float(np.nanmin(a)), float(np.nanmax(a))))


def _geokey(keys, key_id):
    k = list(keys)
    for n in range(4, len(k), 4):
        if k[n] == key_id and k[n + 1] == 0:
            return k[n + 3]
    return None


def open_source(path: Path) -> Source:
    suf = path.suffix.lower()
    if suf in (".lbl", ".img"):
        return PdsGrid(path.with_suffix(".LBL") if path.with_suffix(".LBL").exists() else path.with_suffix(".lbl")) \
            if suf == ".img" else PdsGrid(path)
    return GeoTiff(path)


# ---- geometry -----------------------------------------------------------------------------------
def load_constants() -> dict:
    return json.loads(CONSTANTS.read_text(encoding="utf-8"))


def to_xy_m(lat: float, lon: float, r_km: float) -> tuple[float, float]:
    rho = 2 * r_km * math.tan(math.radians(90 + lat) / 2) * 1000
    return rho * math.sin(math.radians(lon)), rho * math.cos(math.radians(lon))


def site_xy_m(c: dict, site_id: str) -> tuple[float, float]:
    s = c["site_catalog"][site_id]
    return to_xy_m(s["latitude_deg"], s["longitude_deg"], c["map_features"]["moon_radius_km"])


def region_box_m(c: dict, margin_km: float) -> tuple[float, float, float]:
    pts = [(0.0, 0.0)] + [site_xy_m(c, sid) for sid in c["site_catalog"]]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    half = max(max(xs) - min(xs), max(ys) - min(ys)) / 2 + margin_km * 1000
    return cx, cy, half


# ---- output ---------------------------------------------------------------------------------------
def write_grid(out_id: str, src: Source, grid: np.ndarray, cx: float, cy: float, half: float, tier: str, note: str) -> Path:
    good = np.isfinite(grid)
    if not good.any():
        raise SystemExit("the crop window does not overlap the data — check --site / --center")
    lo, hi = float(np.nanmin(grid)), float(np.nanmax(grid))
    off = float(np.round((lo + hi) / 2))
    # finest step that fits the relief in int16 (0.1 m floor): coarse steps show as terraces under a low sun
    step = max(0.1, math.ceil((hi - lo) / 64000 * 100) / 100)
    q = np.where(good, np.clip(np.round((grid - off) / step), -32767, 32767), NODATA).astype("<i2")
    doc = {
        "id": out_id,
        "source": f"{src.name} ({note})",
        "tier": tier,
        "res_m": round(2 * half / grid.shape[0], 3),
        "n": int(grid.shape[0]),
        "cx_km": round(cx / 1000, 4),
        "cy_km": round(cy / 1000, 4),
        "half_km": round(half / 1000, 4),
        "h_offset_m": off,
        "h_scale_m": step,
        "nodata": NODATA,
        "coverage": round(float(good.mean()), 4),
        "heights_b64": base64.b64encode(q.tobytes()).decode("ascii"),
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    p = OUT_DIR / f"{out_id}.json"
    p.write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
    _update_index(out_id, p.name, doc["res_m"], doc["source"])
    rng = (float(np.nanmin(grid)), float(np.nanmax(grid)))
    print(f"wrote {p.relative_to(REPO)}  {p.stat().st_size / 1024:.0f} KB  n={doc['n']}  "
          f"cell={doc['res_m']} m  coverage={doc['coverage']:.0%}  heights {rng[0]:.0f}..{rng[1]:.0f} m")
    return p


def _update_index(out_id: str, file: str, res_m: float, source: str) -> None:
    """Keep public/data/terrain/index.json listing every grid (the map fetches only what is listed)."""
    idx_path = OUT_DIR / "index.json"
    try:
        idx = json.loads(idx_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        idx = {"grids": []}
    idx["grids"] = [g for g in idx.get("grids", []) if g.get("id") != out_id]
    idx["grids"].append({"id": out_id, "file": file, "res_m": res_m, "source": source})
    idx["grids"].sort(key=lambda g: g["res_m"])
    idx_path.write_text(json.dumps(idx, indent=1) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["info", "region", "site"])
    ap.add_argument("path", type=Path)
    ap.add_argument("--site", help="site_catalog id to centre on (mode site)")
    ap.add_argument("--center", default="site", choices=["site", "tile"],
                    help="centre on the catalog site (default) or on the middle of the tile")
    ap.add_argument("--half-km", type=float, default=None, help="half-width of the crop (site: 6, region: auto)")
    ap.add_argument("--margin-km", type=float, default=18.0, help="region: margin around the sites")
    ap.add_argument("--n", type=int, default=None, help="cells per side (site: 256, region: 512)")
    ap.add_argument("--id", help="output name (default: site id, or 'region')")
    a = ap.parse_args()

    src = open_source(a.path)
    if a.mode == "info":
        print(json.dumps(src.meta, indent=2, default=str))
        if isinstance(src, GeoTiff):
            c = load_constants()
            x = (src.x0_m + src.data.shape[1] * src.res_m / 2) / 1000
            y = (src.y0_m - src.data.shape[0] * src.res_m / 2) / 1000
            r = math.hypot(x, y)
            lat = -90 + math.degrees(2 * math.atan(r / (2 * c["map_features"]["moon_radius_km"])))
            lon = math.degrees(math.atan2(x, y)) % 360
            print(f"tile centre ~ lat {lat:.3f}, lon {lon:.2f}")
            for sid in c["site_catalog"]:
                sx, sy = site_xy_m(c, sid)
                inside = src.x0_m <= sx <= src.x0_m + src.data.shape[1] * src.res_m and \
                    src.y0_m - src.data.shape[0] * src.res_m <= sy <= src.y0_m
                print(f"  {sid:20s} {'INSIDE' if inside else 'outside'} this tile")
        return

    c = load_constants()
    if a.mode == "region":
        cx, cy, half = region_box_m(c, a.margin_km)
        if a.half_km:
            half = a.half_km * 1000
        n = a.n or 512
        grid = src.block_mean(cx, cy, half, n)
        write_grid(a.id or "region", src, grid, cx, cy, half, "nasa-data", "LOLA GDR polar grid, resampled")
        return

    if not a.site and a.center == "site":
        raise SystemExit("--site <site_catalog id> is required (or --center tile with --id)")
    if a.center == "tile":
        h, w = src.data.shape
        cx = src.x0_m + w * src.res_m / 2
        cy = src.y0_m - h * src.res_m / 2
    else:
        cx, cy = site_xy_m(c, a.site)
    half = (a.half_km or 6.0) * 1000
    n = a.n or 256
    grid = src.block_mean(cx, cy, half, n)
    write_grid(a.id or a.site, src, grid, cx, cy, half, "nasa-data", "PGDA product 78, LOLA 5 m/px, resampled")


if __name__ == "__main__":
    main()
