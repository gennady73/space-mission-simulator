import type { EngineConstants, TrajectoryOption } from '../models/Interfaces';

/**
 * Launch-segment trajectory helpers (spec §1.2). MVP: the trade is Direct vs Ballistic Lunar Transfer,
 * expressed as descent Δv, cruise time and cost (constants.trajectories). The 2D orbit view
 * (ui/OrbitViewCanvas.ts) draws these paths; it does not integrate orbits.
 */

/** Tsiolkovsky mass ratio m0/mf for a given Δv and Isp. */
export function massRatio(c: EngineConstants, deltaVms: number, ispS: number): number {
  return Math.exp(deltaVms / (ispS * c.system_constants.standard_gravity_g0_m_s2));
}

/** Propellant for landing a given mass with a trajectory option. */
export function landingPropellantKg(c: EngineConstants, landedMassKg: number, t: TrajectoryOption, ispS: number): number {
  return landedMassKg * (massRatio(c, t.descent_delta_v_m_s, ispS) - 1);
}

/** Schematic path for the orbit view: normalised points, Earth at (0,0), Moon at (1,0). */
export function schematicPath(t: TrajectoryOption, samples = 120): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    if (t.id === 'ballistic_lunar_transfer') {
      // loop out toward the Sun-Earth L1/L2 region (~4 lunar distances) and fall back to the Moon
      const a = Math.PI * u;
      pts.push({ x: 2.2 * Math.sin(a) * (1 - u) + u, y: 1.6 * Math.sin(2 * a) });
    } else {
      pts.push({ x: u, y: 0.25 * Math.sin(Math.PI * u) });
    }
  }
  return pts;
}
