/**
 * Diviner cold traps for the map (Lead, D-109). Pure: decoding and lookup only, no DOM.
 *
 * File written by tools/data-pipeline/diviner_grid.py: public/data/diviner/coldtraps.json
 *   tmax_k_b64  n*n uint8, annual maximum surface temperature in K (nodata = 255)
 *   ice_cm_b64  n*n uint8, depth to stable water ice in cm (0 = surface, ice_none = not stable, 255 = no data)
 *   sites       per catalog site: coldest Diviner point near it (cross-check for the Hardware review)
 * Row 0 = north (+y), column 0 = west (-x), polar stereographic km like terrain.ts toXY().
 */

export interface ColdTrapSite { coldest_tmax_k: number; coldest_tavg_k: number; coldest_km: number; coldest_xy_km: [number, number]; ice_surface_km: number | null }
export interface ColdTrapFile {
  id: string;
  source: string;
  n: number;
  cx_km: number;
  cy_km: number;
  half_km: number;
  res_m: number;
  nodata: number;
  ice_none: number;
  tmax_k_b64: string;
  ice_cm_b64: string;
  sites: Record<string, ColdTrapSite>;
}

/** Cell class used by the shader: none, cold trap, cold trap with ice stable at the surface. */
export const ColdClass = { None: 0, Cold: 1, SurfaceIce: 2 } as const;
export type ColdClass = (typeof ColdClass)[keyof typeof ColdClass];

export class ColdTrapGrid {
  readonly source: string;
  readonly resM: number;
  readonly sites: Record<string, ColdTrapSite>;
  private readonly n: number;
  private readonly x0: number;
  private readonly y0: number;
  private readonly cell: number;
  private readonly tmax: Uint8Array;
  private readonly ice: Uint8Array;
  private readonly nodata: number;

  constructor(f: ColdTrapFile, private readonly maxTempK: number) {
    this.source = f.source; this.resM = f.res_m; this.sites = f.sites;
    this.n = f.n; this.nodata = f.nodata;
    this.cell = (2 * f.half_km) / f.n;
    this.x0 = f.cx_km - f.half_km; this.y0 = f.cy_km + f.half_km;
    this.tmax = bytes(f.tmax_k_b64); this.ice = bytes(f.ice_cm_b64);
  }

  private index(x: number, y: number): number {
    const c = Math.floor((x - this.x0) / this.cell), r = Math.floor((this.y0 - y) / this.cell);
    return c < 0 || r < 0 || c >= this.n || r >= this.n ? -1 : r * this.n + c;
  }

  /** True where Diviner has data, so the schematic shadow discs are not needed. */
  covers(x: number, y: number): boolean {
    const k = this.index(x, y);
    return k >= 0 && this.tmax[k] !== this.nodata;
  }

  classify(x: number, y: number): ColdClass {
    const k = this.index(x, y);
    if (k < 0 || this.tmax[k] === this.nodata || this.tmax[k] >= this.maxTempK) return ColdClass.None;
    return this.ice[k] === 0 ? ColdClass.SurfaceIce : ColdClass.Cold;
  }

  /** Annual maximum temperature (K) at a point, or null where there is no data. */
  tmaxAt(x: number, y: number): number | null {
    const k = this.index(x, y);
    return k < 0 || this.tmax[k] === this.nodata ? null : this.tmax[k];
  }
}

function bytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function fetchColdTraps(maxTempK: number, url = './data/diviner/coldtraps.json'): Promise<ColdTrapGrid | null> {
  try {
    const r = await fetch(url);
    return r.ok ? new ColdTrapGrid((await r.json()) as ColdTrapFile, maxTempK) : null;
  } catch {
    return null;
  }
}

/**
 * Permanent-shadow masks around each site (PGDA product 69 LPSR, 60 m; D-111), written by
 * tools/data-pipeline/psr_grid.py to public/data/psr/sites.json. Finer than Diviner, so the
 * close-ups can show the small shadowed pockets near a landing site.
 */
export interface PsrFile { source: string; grids: Array<{ id: string; site: string; n: number; cx_km: number; cy_km: number; half_km: number; res_m: number; psr_b64: string }> }

/** Drawing only: blur taps (in cells) and the soft-step window for PsrGrid.soft(). */
const SOFT_TAP_CELLS = 0.6;
const SOFT_TAPS: ReadonlyArray<readonly [number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1], [1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]];
const SOFT_LO = 0.28;
const SOFT_HI = 0.62;

export class PsrGrid {
  private readonly x0: number;
  private readonly y0: number;
  private readonly cell: number;
  private readonly mask: Uint8Array;
  constructor(private readonly n: number, cx: number, cy: number, half: number, b64: string) {
    this.cell = (2 * half) / n; this.x0 = cx - half; this.y0 = cy + half; this.mask = bytes(b64);
  }
  /**
   * null outside the mask, otherwise whether (x, y) is permanently shadowed. The 0/1 cells are
   * interpolated and cut at one half, so shadow pockets have smooth outlines instead of 60 m blocks.
   */
  at(x: number, y: number): boolean | null {
    const f = this.fraction(x, y);
    return f === null ? null : f >= 0.5;
  }

  /** Bilinear mask value in [0, 1] (soft shadow edge), or null outside the mask (D-118). */
  fraction(x: number, y: number): number | null {
    const fc = (x - this.x0) / this.cell - 0.5, fr = (this.y0 - y) / this.cell - 0.5;
    if (fc < -0.5 || fr < -0.5 || fc > this.n - 0.5 || fr > this.n - 0.5) return null;
    const n = this.n, m = this.mask;
    const c0 = Math.max(0, Math.min(n - 2, Math.floor(fc))), r0 = Math.max(0, Math.min(n - 2, Math.floor(fr)));
    const tc = Math.max(0, Math.min(1, fc - c0)), tr = Math.max(0, Math.min(1, fr - r0));
    return (m[r0 * n + c0] * (1 - tc) + m[r0 * n + c0 + 1] * tc) * (1 - tr)
      + (m[(r0 + 1) * n + c0] * (1 - tc) + m[(r0 + 1) * n + c0 + 1] * tc) * tr;
  }

  /**
   * Shadow coverage in [0, 1] for drawing (D-120): the mask blurred over about one cell and cut
   * with a soft step, so a 60 m cell becomes a rounded patch with a feathered rim instead of a
   * hard square. null outside the mask. Display only; `at()` still answers "is it shadowed".
   */
  soft(x: number, y: number): number | null {
    const f = this.fraction(x, y);
    if (f === null) return null;
    const d = this.cell * SOFT_TAP_CELLS;
    let sum = f * 2, w = 2;
    for (const [ox, oy] of SOFT_TAPS) {
      const t = this.fraction(x + ox * d, y + oy * d);
      if (t !== null) { sum += t; w++; }
    }
    const t = Math.max(0, Math.min(1, (sum / w - SOFT_LO) / (SOFT_HI - SOFT_LO)));
    return t * t * (3 - 2 * t);
  }
}

export async function fetchPsrGrids(url = './data/psr/sites.json'): Promise<PsrGrid[]> {
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const f = (await r.json()) as PsrFile;
    return f.grids.map((g) => new PsrGrid(g.n, g.cx_km, g.cy_km, g.half_km, g.psr_b64));
  } catch {
    return [];
  }
}
