import { GATE_NAMES, validateCDR, validateMCR, validatePDR, validateSRR } from '../engine/StageGateValidators';
import { isResolved, resolveDesign, type ResolvedDesign } from '../engine/SubsystemEngines';
import { PHASES, REFERENCE_DESIGN } from '../models/StateStore';
import type { EngineConstants, GateValidationResult, Phase, SimulationState } from '../models/Interfaces';

/**
 * How the cockpit walks a design through the reviews (D-023).
 *
 * Each review needs the choices of its own phase and of the phases before it. Choices that
 * belong to later phases are not made yet, so the engine is given the reference design's
 * choice for them: a planning allocation, the way a real project carries estimates for
 * subsystems it has not designed. Every review re-runs the earlier reviews, so growth in
 * mass or load is caught at the next gate.
 */

type DesignKey =
  | 'selectedSite' | 'selectedLaunchVehicle' | 'selectedLaunchpad' | 'padDistanceM' | 'selectedMast'
  | 'selectedBattery' | 'selectedComm' | 'selectedStorage' | 'selectedLogistics' | 'selectedUtilityLink';

export const DESIGN_PHASES: Phase[] = PHASES.filter((p) => p !== 'PLAR');

/** What the player must choose in each phase, with the label used in messages. */
export const PHASE_CHOICES: Record<Phase, Array<{ key: DesignKey; label: string }>> = {
  MCR: [{ key: 'selectedSite', label: 'landing site' }],
  SRR: [
    { key: 'selectedLaunchVehicle', label: 'launch vehicle' },
    { key: 'selectedLaunchpad', label: 'landing pad' },
    { key: 'padDistanceM', label: 'pad standoff distance' },
  ],
  PDR: [
    { key: 'selectedMast', label: 'power mast' },
    { key: 'selectedBattery', label: 'battery' },
    { key: 'selectedComm', label: 'communications' },
    { key: 'selectedStorage', label: 'data storage' },
  ],
  CDR: [
    { key: 'selectedLogistics', label: 'cold-trap logistics' },
    { key: 'selectedUtilityLink', label: 'utility power link' },
  ],
  PLAR: [],
};

export interface Provisional {
  design: ResolvedDesign | null;
  /** Labels of the choices filled from the reference design. Empty when the design is complete. */
  assumed: string[];
}

/** Resolve the design, filling choices not made yet from the reference design. */
export function provisionalDesign(c: EngineConstants, state: SimulationState): Provisional {
  const patch: Partial<Record<DesignKey, string | number | null>> = {};
  const assumed: string[] = [];
  for (const phase of DESIGN_PHASES) {
    for (const { key, label } of PHASE_CHOICES[phase]) {
      if (state[key] === null) {
        patch[key] = REFERENCE_DESIGN[key];
        assumed.push(label);
      }
    }
  }
  const resolved = resolveDesign(c, { ...state, ...patch } as SimulationState);
  return { design: isResolved(resolved) ? resolved : null, assumed };
}

const incomplete = (phase: Phase, missing: string[]): GateValidationResult => ({
  passed: false,
  gateName: GATE_NAMES[phase],
  governingStandard: 'Review entry criteria',
  reasonCode: 'ERR_DESIGN_INCOMPLETE',
  diagnosticExplanation: `The review cannot start. Still to choose: ${missing.join(', ')}.`,
  remediationAction: 'Make the missing choices on this screen, then submit again.',
});

function gate(c: EngineConstants, phase: Phase, r: ResolvedDesign): GateValidationResult {
  switch (phase) {
    case 'MCR': return validateMCR(c, r.site, r.challenges.farSide !== null);
    case 'SRR': return validateSRR(c, r);
    case 'PDR': return validatePDR(c, r);
    default: return validateCDR(c, r);
  }
}

/**
 * Submit the design to the review of `phase`. Runs every review up to and including it
 * and returns each result, stopping at the first failure.
 */
export function submitToReview(c: EngineConstants, state: SimulationState, phase: Phase): Partial<Record<Phase, GateValidationResult>> {
  const upTo = DESIGN_PHASES.slice(0, DESIGN_PHASES.indexOf(phase) + 1);
  const needsColdTrap = state.selectedSite ? (c.site_catalog[state.selectedSite]?.distance_to_cold_trap_km ?? 0) > 0 : true;
  const missing = upTo
    .flatMap((p) => PHASE_CHOICES[p])
    .filter(({ key }) => needsColdTrap || (key !== 'selectedLogistics' && key !== 'selectedUtilityLink'))
    .filter(({ key }) => state[key] === null)
    .map(({ label }) => label);
  if (missing.length) return { [phase]: incomplete(phase, missing) };

  const { design } = provisionalDesign(c, state);
  if (!design) return { [phase]: incomplete(phase, ['a valid catalog choice']) };
  const results: Partial<Record<Phase, GateValidationResult>> = {};
  for (const p of upTo) {
    results[p] = gate(c, p, design);
    if (!results[p]!.passed) break;
  }
  return results;
}
