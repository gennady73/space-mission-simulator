import { describe, expect, it } from 'vitest';
import { ColdClass, ColdTrapGrid, type ColdTrapFile } from '../src/ui/map/coldTraps';

const b64 = (a: number[]) => btoa(String.fromCharCode(...a));

/** 2×2 grid over ±1 km: NW 40 K with surface ice, NE 90 K ice 30 cm deep, SW 200 K, SE no data. */
const file: ColdTrapFile = {
  id: 'diviner', source: 'test', n: 2, cx_km: 0, cy_km: 0, half_km: 1, res_m: 1000, nodata: 255, ice_none: 254,
  tmax_k_b64: b64([40, 90, 200, 255]), ice_cm_b64: b64([0, 30, 254, 255]), sites: {},
};

describe('Diviner cold traps (D-109)', () => {
  const g = new ColdTrapGrid(file, 110);
  it('classifies cells by annual maximum temperature and surface ice', () => {
    expect(g.classify(-0.5, 0.5)).toBe(ColdClass.SurfaceIce);
    expect(g.classify(0.5, 0.5)).toBe(ColdClass.Cold);
    expect(g.classify(-0.5, -0.5)).toBe(ColdClass.None);
  });
  it('reports coverage and temperature, and nothing outside or on no-data cells', () => {
    expect(g.tmaxAt(0.5, 0.5)).toBe(90);
    expect(g.covers(0.5, -0.5)).toBe(false);
    expect(g.covers(5, 5)).toBe(false);
    expect(g.tmaxAt(5, 5)).toBeNull();
  });
});
