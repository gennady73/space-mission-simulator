import type { EngineConstants, Phase, SimulationState } from '../models/Interfaces';
import { h } from './dom';

export interface PreStageActions {
  /** Store the player's hypothesis for a phase (D-031). An empty string withdraws it. */
  recordHypothesis(phase: Phase, text: string): void;
}

/** Which phases the player has unfolded; survives re-renders, resets on reload (presentation only). */
const openPhases = new Set<Phase>();

/**
 * Feynman "questions first" card (spec §8.1, D-030): each phase opens with a question.
 * The player writes a hypothesis, and only then is the explanation revealed. The
 * hypothesis lives in state.userHypotheses, so it survives export, import and share.
 *
 * Folded to one line by default (D-113): the question is always visible in the summary,
 * the writing space only when the player opens it, so the card no longer dominates the panel.
 */
export function renderPreStageQuestion(c: EngineConstants, s: SimulationState, a: PreStageActions): HTMLElement {
  const phase = s.currentPhase;
  const q = c.pre_stage_questions[phase];
  const recorded = (s.userHypotheses[phase] ?? '').trim();

  const box = h('details', { class: 'prestage', ...(openPhases.has(phase) ? { open: '' } : {}) });
  box.addEventListener('toggle', () => { if (box.open) openPhases.add(phase); else openPhases.delete(phase); });
  box.append(h('summary', { 'aria-label': 'Think first' },
    h('b', {}, 'Think first'),
    h('span', { id: 'pre-stage-question', class: 'prestage-q' }, q.question),
    h('span', { class: 'prestage-state' }, recorded ? '✓ answered' : 'answer it')));

  const body = h('div', { class: 'prestage-body' });
  const input = h('textarea', {
    id: 'input-hypothesis', rows: '3',
    placeholder: 'Write what you think in a sentence or two, then compare it with the answer.',
  });
  input.value = s.userHypotheses[phase] ?? '';
  body.append(h('label', { class: 'field wide' }, 'Your hypothesis ', input));

  if (recorded) {
    input.addEventListener('change', () => a.recordHypothesis(phase, input.value));
    body.append(h('p', { id: 'pre-stage-explanation' }, h('strong', {}, 'The answer: '), q.explanation));
  } else {
    const reveal = h('button', { id: 'btn-reveal-explanation', type: 'button', class: 'secondary', disabled: '' },
      'Record my hypothesis and show the answer');
    input.addEventListener('input', () => reveal.toggleAttribute('disabled', input.value.trim() === ''));
    reveal.addEventListener('click', () => a.recordHypothesis(phase, input.value));
    body.append(reveal);
  }
  box.append(body);
  return box;
}
