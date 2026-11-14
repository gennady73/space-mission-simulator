/**
 * Real LOLA height grids (Lead, D-106). Pure: decoding and sampling only, no DOM.
 *
 * Files are written by tools/data-pipeline/lola_crop.py into public/data/terrain/:
 *   index.json  { "grids": [ { "id", "file", "res_m", "source" } ] }
 *   <id>.json   { id, source, tier, res_m, n, cx_km, cy_km, half_km, h_offset_m, nodata, heights_b64 }
 * heights_b64 = n*n little-endian int16; metres = value * h_scale_m + h_offset_m; row 0 = north (+y), column 0 = west (-x),
 * in the same polar stereographic km as terrain.ts toXY().
 */

export interface TerrainGridFile {
  id: string;
  source: string;
  tier: string;
  res_m: number;
  n: number;
  cx_km: number;
  cy_km: number;
  half_km: number;
  h_offset_m: number;
  /** Metres per int16 step (absent in early files = 1). */
  h_scale_m?: number;
  nodata: number;
  heights_b64: string;
}
export interface TerrainIndex { grids: Array<{ id: string; file: string; res_m: number; source: string }> }

/** Fraction of the half-width over which a grid fades into the coarser layer below it. */
const FEATHER = 0.12;
const M_PER_KM = 1000;

export class RealGrid {
  readonly id: string;
  readonly source: string;
  readonly resM: number;
  readonly n: number;
  readonly cx: number;
  readonly cy: number;
  readonly half: number;
  /** Heights in km; NaN where the source had no data. */
  readonly z: Float32Array;

  constructor(f: TerrainGridFile) {
    this.id = f.id; this.source = f.source; this.resM = f.res_m; this.n = f.n;
    this.cx = f.cx_km; this.cy = f.cy_km; this.half = f.half_km;
    const bytes = decodeBase64(f.heights_b64);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.z = new Float32Array(f.n * f.n);
    for (let k = 0; k < this.z.length; k++) {
      const v = view.getInt16(2 * k, true);
      this.z[k] = v === f.nodata ? Number.NaN : (v * (f.h_scale_m ?? 1) + f.h_offset_m) / M_PER_KM;
    }
  }

  /** Bilinear height (km) and an edge weight in [0, 1]; weight 0 means "not covered here". */
  sample(x: number, y: number): { h: number; w: number } {
    const dx = Math.abs(x - this.cx), dy = Math.abs(y - this.cy);
    const edge = this.half - Math.max(dx, dy);
    if (edge <= 0) return { h: 0, w: 0 };
    const cell = (2 * this.half) / this.n;
    const fc = (x - (this.cx - this.half)) / cell - 0.5;
    const fr = ((this.cy + this.half) - y) / cell - 0.5;
    const c0 = Math.max(0, Math.min(this.n - 2, Math.floor(fc)));
    const r0 = Math.max(0, Math.min(this.n - 2, Math.floor(fr)));
    const tc = Math.max(0, Math.min(1, fc - c0)), tr = Math.max(0, Math.min(1, fr - r0));
    const n = this.n, z = this.z;
    const a = z[r0 * n + c0], b = z[r0 * n + c0 + 1], c = z[(r0 + 1) * n + c0], d = z[(r0 + 1) * n + c0 + 1];
    const h = (a * (1 - tc) + b * tc) * (1 - tr) + (c * (1 - tc) + d * tc) * tr;
    if (!Number.isFinite(h)) return { h: 0, w: 0 };
    return { h, w: Math.min(1, edge / (FEATHER * this.half)) };
  }
}

/** Height from a stack of grids, finest first, each fading into the next; NaN when none covers (x, y). */
export function stackHeight(grids: RealGrid[], x: number, y: number): number {
  let h = 0, remaining = 1;
  for (const g of grids) {
    const s = g.sample(x, y);
    if (s.w <= 0) continue;
    const take = remaining * s.w;
    h += take * s.h;
    remaining -= take;
    if (remaining <= 1e-6) return h;
  }
  return remaining >= 1 ? Number.NaN : h / (1 - remaining);
}

function decodeBase64(b64: string): Uint8Array {
  const s = atob(b64); // browsers and Node ≥ 16
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Fetch every grid in public/data/terrain/index.json. Missing index or files → empty list (schematic terrain stays). */
export async function fetchRealGrids(base = './data/terrain/'): Promise<RealGrid[]> {
  try {
    const idx = await fetch(`${base}index.json`);
    if (!idx.ok) return [];
    const index = (await idx.json()) as TerrainIndex;
    const grids = await Promise.all(index.grids.map(async (g) => {
      const r = await fetch(`${base}${g.file}`);
      return r.ok ? new RealGrid((await r.json()) as TerrainGridFile) : null;
    }));
    return grids.filter((g): g is RealGrid => g !== null).sort((a, b) => a.resM - b.resM);
  } catch {
    return [];
  }
}
