import { describe, expect, it } from 'vitest';
import { RealGrid, stackHeight, type TerrainGridFile } from '../src/ui/map/realTerrain';

/** n×n grid where the stored value is the column index (so height rises to the east). */
function grid(id: string, cx: number, cy: number, half: number, n: number, offsetM: number, scaleM = 1, holeAt?: number): TerrainGridFile {
  const a = new Int16Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) a[r * n + c] = r * n + c === holeAt ? -32768 : c;
  const bytes = new Uint8Array(a.buffer);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return { id, source: 'test', tier: 'nasa-data', res_m: (2 * half * 1000) / n, n, cx_km: cx, cy_km: cy, half_km: half, h_offset_m: offsetM, h_scale_m: scaleM, nodata: -32768, heights_b64: btoa(s) };
}

describe('real LOLA grids (D-106)', () => {
  it('decodes int16 heights with offset and scale and samples them bilinearly', () => {
    const g = new RealGrid(grid('a', 0, 0, 1, 4, 100, 0.5));
    // cell centres at x = -0.75, -0.25, 0.25, 0.75 km hold columns 0..3 → 100, 100.5, 101, 101.5 m
    expect(g.sample(-0.25, 0).h * 1000).toBeCloseTo(100.5, 6);
    expect(g.sample(0, 0).h * 1000).toBeCloseTo(100.75, 6);
    expect(g.sample(2, 0).w).toBe(0); // outside
    expect(g.sample(0, 0).w).toBe(1); // far from the edge
    expect(g.sample(0.95, 0).w).toBeGreaterThan(0);
    expect(g.sample(0.95, 0).w).toBeLessThan(1); // feathered near the edge
  });

  it('treats nodata as not covered', () => {
    const g = new RealGrid(grid('a', 0, 0, 1, 4, 0, 1, 5)); // row 1, col 1
    expect(g.sample(-0.25, 0.25).w).toBe(0);
  });

  it('prefers the finer grid and falls back to the coarser one', () => {
    const fine = new RealGrid(grid('fine', 0, 0, 1, 4, 500));
    const coarse = new RealGrid(grid('coarse', 0, 0, 10, 4, -500));
    expect(stackHeight([fine, coarse], 0, 0) * 1000).toBeGreaterThan(499);
    expect(stackHeight([fine, coarse], 5, 0) * 1000).toBeLessThan(0);
    expect(Number.isNaN(stackHeight([fine, coarse], 50, 0))).toBe(true);
  });
});
