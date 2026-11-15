import './side-quests.css';
import type { EngineConstants, Phase, SideQuestConfig } from '../models/Interfaces';
import { h } from './dom';
import { closePopover, togglePopover } from './popover';
import { checkAnswer, questsForPhase, TRIES_BEFORE_REVEAL } from './sideQuestModel';
import { renderStickyNote, stickyIcon } from './StickyNote';

/**
 * "Want to know more?" side-quests (spec §8.2, REQ-008). Optional and never blocking:
 * a solved quest is only remembered in `completedQuests`; no gate depends on it.
 *
 * Usage in the cockpit (one line after the phase panel):
 *   const quests = renderSideQuests(c, s.currentPhase, s.completedQuests, hintsEnabled, (id) => a.update({ completedQuests: [...s.completedQuests, id] }));
 *   if (quests) main.append(quests);
 *
 * Test hooks: #btn-quest-<questId>, #input-quest-answer, #btn-quest-check, #btn-quest-hint,
 * .quest-feedback--correct / --wrong / --invalid, .quest-explanation.
 */
export function renderSideQuests(
  c: EngineConstants, phase: Phase, completed: string[], hintsEnabled: boolean, onSolved: (questId: string) => void,
): HTMLElement | null {
  const quests = questsForPhase(c, phase);
  if (quests.length === 0) return null;
  const list = (): HTMLElement => {
    const ul = h('ul', { class: 'quests__list' });
    for (const q of quests) {
      const done = completed.includes(q.id);
      const button = h('button', { type: 'button', id: `btn-quest-${q.id}`, class: done ? 'quest-btn quest-btn--done' : 'quest-btn' },
        done ? `✓ ${q.title}` : q.title);
      button.addEventListener('click', () => openQuest(q, hintsEnabled, () => { if (!completed.includes(q.id)) onSolved(q.id); }));
      ul.append(h('li', {}, button));
    }
    return ul;
  };
  // One row (D-303): the heading and the number of quests; the list opens in a popover. The quest dialog is unchanged.
  const solved = quests.filter((q) => completed.includes(q.id)).length;
  const count = `${quests.length} ${quests.length === 1 ? 'quest' : 'quests'}${solved ? ` · ${solved} solved` : ''}`;
  const row = h('button', { type: 'button', id: 'btn-quests', class: 'quests-row', 'aria-expanded': 'false', 'aria-haspopup': 'dialog' },
    h('span', { class: 'quests-row__tab', 'aria-hidden': 'true' }, stickyIcon('tip')), // a small yellow sticky tab: this is an optional tip (D-304)
    h('span', { class: 'quests-row__title' }, 'Want to know more?'),
    h('span', { class: 'quests-row__count' }, count),
    h('span', { class: 'quests-row__chevron', 'aria-hidden': 'true' }, '▸'));
  // The popover holds one yellow note (D-304): the invitation, then the quests after the divider.
  row.addEventListener('click', () => togglePopover(row, 'Want to know more?', () => [
    renderStickyNote({
      kind: 'tip', title: 'Want to know more?',
      body: 'Optional: try the arithmetic the engineers do at this review. It does not change your mission.',
      footer: list(), onClose: () => closePopover(),
    }),
  ]));
  return h('section', { class: 'quests', 'aria-label': 'Optional calculations' }, row);
}

/**
 * The quest dialog. Outcomes are sticky notes (D-304) in one slot, so only one note is visible at a time:
 * hint = tip, correct = success, wrong = mistake, worked answer = tip. An invalid entry stays a plain line.
 * Quest text comes from the constants; the only new strings are the note titles and "Try the hint."
 */
function openQuest(q: SideQuestConfig, hintsEnabled: boolean, onSolved: () => void): void {
  let tries = 0;
  let solved = false;
  let hintShown = false;
  const dialog = h('dialog', { class: 'quest', 'aria-labelledby': 'quest-title' });
  const input = h('input', { id: 'input-quest-answer', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-describedby': 'quest-unit' });
  const feedback = h('p', { class: 'quest-feedback', role: 'status', 'aria-live': 'polite' });
  const slot = h('div', { class: 'quest-note' });
  const extra = h('div', { class: 'quest-extra' });
  const check = h('button', { type: 'submit', id: 'btn-quest-check' }, 'Check');
  const close = h('button', { type: 'button', class: 'quest-close', 'aria-label': 'Close' }, '×');

  const setNote = (note: HTMLElement | null) => {
    feedback.className = 'quest-feedback';
    feedback.textContent = '';
    slot.replaceChildren(...(note ? [note] : []));
  };
  const showHint = () => {
    hintShown = true;
    setNote(renderStickyNote({ kind: 'tip', title: 'Hint', body: q.hint, footer: h('code', {}, q.formula), class: 'quest-hint', onClose: () => setNote(null) }));
  };
  const showWorkedAnswer = () => {
    setNote(renderStickyNote({ kind: 'tip', title: 'Worked answer', body: h('span', { class: 'quest-explanation' }, q.explanation), onClose: () => setNote(null) }));
  };

  const form = h('form', { class: 'quest-form' },
    h('label', { for: 'input-quest-answer' }, 'Your answer'),
    h('div', { class: 'quest-row' }, input, h('span', { id: 'quest-unit', class: 'quest-unit' }, q.unit), check));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (solved) return;
    const r = checkAnswer(q, input.value);
    if (r.status === 'invalid') {
      feedback.className = 'quest-feedback quest-feedback--invalid';
      feedback.textContent = `Type a number, in ${q.unit}.`;
      return;
    }
    if (r.status === 'correct') {
      solved = true;
      setNote(renderStickyNote({ kind: 'success', title: 'Correct.', body: h('span', { class: 'quest-explanation' }, q.explanation), class: 'quest-feedback--correct' }));
      extra.replaceChildren(); // the worked-answer offer is moot once solved
      input.setAttribute('readonly', '');
      check.setAttribute('disabled', '');
      onSolved();
      return;
    }
    tries++;
    setNote(renderStickyNote({
      kind: 'mistake', title: 'Not quite yet.', class: 'quest-feedback--wrong',
      body: `${r.value.toLocaleString('en-US')} ${q.unit} is too ${r.direction}. Try again.`,
      ...(hintsEnabled && !hintShown ? { footer: 'Try the hint.' } : {}),
    }));
    if (tries >= TRIES_BEFORE_REVEAL && !extra.querySelector('.quest-reveal')) {
      const reveal = h('button', { type: 'button', class: 'quest-reveal' }, 'Show the worked answer');
      reveal.addEventListener('click', showWorkedAnswer);
      extra.append(reveal);
    }
  });

  const hintBtn = hintsEnabled ? h('button', { type: 'button', id: 'btn-quest-hint', class: 'quest-hint-btn' }, 'Hint') : null;
  hintBtn?.addEventListener('click', showHint);

  dialog.append(
    h('header', { class: 'quest-head' }, h('h3', { id: 'quest-title' }, q.title), close),
    h('p', { class: 'quest-prompt' }, q.prompt),
    form, feedback, ...(hintBtn ? [hintBtn] : []), slot, extra,
  );
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  input.focus();
}
