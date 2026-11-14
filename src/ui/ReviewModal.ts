import { DESIGN_PHASES } from './DesignFlow';
import { renderGateBanner } from './DebriefView';
import { h } from './dom';
import type { GateValidationResult, Phase } from '../models/Interfaces';

/** One submission to a review: every gate that was run, and the first that failed (if any). */
export interface ReviewOutcome {
  phase: Phase;
  results: Partial<Record<Phase, GateValidationResult>>;
  failed: GateValidationResult | null;
}

export interface ReviewActions {
  /** After a pass: move on to the next stage, or launch after CDR. */
  reviewNext(): void;
  /** Close the verdict and go back to the stage panel. */
  reviewRevise(): void;
}

/**
 * Review board verdict (D-035): shown after "Submit to review". Pass or fail, the reason and
 * the fix come straight from the gate result; then "Next stage" or "Revise".
 * Ids: #review-modal, #review-verdict, #btn-review-next, #btn-review-revise.
 */
export function renderReviewModal(review: ReviewOutcome, a: ReviewActions): HTMLElement {
  const verdict = review.failed ?? review.results[review.phase];
  const passed = !review.failed;
  const ran = DESIGN_PHASES.filter((p) => review.results[p]);
  const next = h('button', { id: 'btn-review-next', type: 'button' }, review.phase === 'CDR' ? 'Launch' : 'Next stage');
  next.addEventListener('click', a.reviewNext);
  const revise = h('button', { id: 'btn-review-revise', type: 'button', class: passed ? 'secondary' : '' }, passed ? 'Stay and revise' : 'Revise');
  revise.addEventListener('click', a.reviewRevise);

  const card = h('div', { id: 'review-modal', class: `review ${passed ? 'is-pass' : 'is-fail'}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'review-verdict' },
    h('p', { class: 'review-kicker' }, `${review.phase} review board`),
    h('h2', { id: 'review-verdict' }, passed ? 'Verdict: passed' : 'Verdict: not passed'),
    verdict && renderGateBanner(verdict),
    ran.length > 1 && h('ul', { class: 'review-gates', 'aria-label': 'Reviews checked in this submission' },
      ...ran.map((p) => h('li', { 'data-passed': String(!!review.results[p]?.passed) }, `${p} ${review.results[p]?.passed ? '✓' : '✗'}`))),
    h('div', { class: 'actions' }, passed && next, revise),
  );
  const backdrop = h('div', { class: 'review-backdrop' }, card);
  backdrop.addEventListener('keydown', (e) => { if (e.key === 'Escape') a.reviewRevise(); });
  // Focus the main action once the modal is in the document.
  queueMicrotask(() => (passed ? next : revise).focus());
  return backdrop;
}
