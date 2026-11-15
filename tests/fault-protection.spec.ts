import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseConstants } from '../src/engine/ConstantsLoader';
import { runMission } from '../src/engine/SimulationClock';
import { dryMassKg, isResolved, resolveDesign, totalCostUSD, type ResolvedDesign } from '../src/engine/SubsystemEngines';
import { REFERENCE_DESIGN } from '../src/models/StateStore';

/** D-039: onboard fault protection and safing (NASA "Basics of Space Flight", ch. 11). */
const c = parseConstants(JSON.parse(readFileSync('public/config/engine-constants.json', 'utf8')));
const rover = (faultProtection: boolean): ResolvedDesign => {
  const r = resolveDesign(c, { ...REFERENCE_DESIGN, selectedLogistics: 'viper_heritage_rover', faultProtection });
  if (!isResolved(r)) throw new Error(r.missing.join(', '));
  return r;
};
const fly = (r: ResolvedDesign, seed: number) => runMission(c, r, { seed, randomEvents: true });
const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
const failedSeeds = seeds.filter((s) => fly(rover(false), s).events.some((e) => /failed permanently/.test(e.text)));

describe('fault protection (D-039)', () => {
  it('adds its mass and cost to the design', () => {
    expect(dryMassKg(rover(true)) - dryMassKg(rover(false))).toBeCloseTo(c.fault_protection.mass_kg, 6);
    expect(totalCostUSD(rover(true)) - totalCostUSD(rover(false))).toBeCloseTo(c.fault_protection.cost_usd, 6);
  });

  it('the rover fails in some years, so the option has something to protect', () => {
    expect(failedSeeds.length).toBeGreaterThan(0);
  });

  it('a safed failure is either recovered after Earth contact, with more ice, or declared lost', () => {
    let recovered = 0, lost = 0;
    for (const seed of failedSeeds) {
      const without = fly(rover(false), seed);
      const withFp = fly(rover(true), seed);
      expect(withFp.events.some((e) => /safe mode and is waiting/.test(e.text))).toBe(true);
      if (withFp.events.some((e) => /Ground team recovered/.test(e.text))) {
        recovered++;
        expect(withFp.iceKg).toBeGreaterThan(without.iceKg);
      } else if (withFp.events.some((e) => /could not recover/.test(e.text))) {
        lost++;
        expect(withFp.iceKg).toBeCloseTo(without.iceKg, 6);
      }
    }
    expect(recovered).toBeGreaterThan(0);
    expect(recovered + lost).toBeGreaterThan(0);
  });

  it('without fault protection a run is unchanged by the option existing (same random sequence)', () => {
    const a = fly(rover(false), 7);
    const b = runMission(c, rover(false), { seed: 7, randomEvents: true });
    expect(a).toEqual(b);
  });

  it('the light-time quest answer matches its own inputs', () => {
    expect(c.side_quests.quest_light_time.correct_value).toBeCloseTo((2 * 384_400) / 300_000, 2);
  });
});
