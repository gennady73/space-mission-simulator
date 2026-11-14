import type { EngineConstants, Phase, SimulationState } from '../models/Interfaces';
import { h } from './dom';

export interface PreStageActions {
  /** Store the player's hypothesis for a phase (D-031). An empty string withdraws it. */
  recordHypothesis(phase: Phase, text: string): void;
}

/**
 * Feynman "questions first" card (spec §8.1, D-030): each phase opens with a question.
 * The player writes a hypothesis, and only then is the explanation revealed. The
 * hypothesis lives in state.userHypotheses, so it survives export, import and share.
 */
export function renderPreStageQuestion(c: EngineConstants, s: SimulationState, a: PreStageActions): HTMLElement {
  const phase = s.currentPhase;
  const q = c.pre_stage_questions[phase];
  const recorded = (s.userHypotheses[phase] ?? '').trim();
  const box = h('section', { class: 'prestage', 'aria-label': 'Think first' },
    h('h3', {}, 'Think first'),
    h('p', { id: 'pre-stage-question' }, q.question));

  const input = h('textarea', {
    id: 'input-hypothesis', rows: '3',
    placeholder: 'Write what you think in a sentence or two, then compare it with the answer.',
  });
  input.value = s.userHypotheses[phase] ?? '';
  box.append(h('label', { class: 'field wide' }, 'Your hypothesis ', input));

  if (recorded) {
    input.addEventListener('change', () => a.recordHypothesis(phase, input.value));
    box.append(h('p', { id: 'pre-stage-explanation' }, h('strong', {}, 'The answer: '), q.explanation));
  } else {
    const reveal = h('button', { id: 'btn-reveal-explanation', type: 'button', class: 'secondary', disabled: '' },
      'Record my hypothesis and show the answer');
    input.addEventListener('input', () => reveal.toggleAttribute('disabled', input.value.trim() === ''));
    reveal.addEventListener('click', () => a.recordHypothesis(phase, input.value));
    box.append(reveal);
  }
  return box;
}
