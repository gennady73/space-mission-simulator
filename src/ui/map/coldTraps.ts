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
