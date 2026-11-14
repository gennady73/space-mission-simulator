import './side-quests.css';
import type { EngineConstants, Phase, SideQuestConfig } from '../models/Interfaces';
import { h } from './dom';
import { checkAnswer, questsForPhase, TRIES_BEFORE_REVEAL } from './sideQuestModel';

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
  const section = h('section', { class: 'quests', 'aria-label': 'Optional calculations' },
    h('h3', {}, 'Want to know more?'),
    h('p', { class: 'hint' }, 'Optional: try the arithmetic the engineers do at this review. It does not change your mission.'));
  const list = h('ul', { class: 'quests__list' });
  for (const q of quests) {
    const done = completed.includes(q.id);
    const button = h('button', { type: 'button', id: `btn-quest-${q.id}`, class: done ? 'quest-btn quest-btn--done' : 'quest-btn' },
      done ? `✓ ${q.title}` : q.title);
    button.addEventListener('click', () => openQuest(q, hintsEnabled, () => { if (!completed.includes(q.id)) onSolved(q.id); }));
    list.append(h('li', {}, button));
  }
  section.append(list);
  return section;
}

function openQuest(q: SideQuestConfig, hintsEnabled: boolean, onSolved: () => void): void {
  let tries = 0;
  let solved = false;
  const dialog = h('dialog', { class: 'quest', 'aria-labelledby': 'quest-title' });
  const input = h('input', { id: 'input-quest-answer', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-describedby': 'quest-unit' });
  const feedback = h('p', { class: 'quest-feedback', role: 'status', 'aria-live': 'polite' });
  const extra = h('div', { class: 'quest-extra' });
  const check = h('button', { type: 'submit', id: 'btn-quest-check' }, 'Check');
  const close = h('button', { type: 'button', class: 'quest-close', 'aria-label': 'Close' }, '×');

  const showExplanation = (prefix: string) => {
    extra.replaceChildren(h('p', { class: 'quest-explanation' }, h('strong', {}, prefix), ' ', q.explanation));
  };
  const showHint = () => {
    if (extra.querySelector('.quest-hint')) return;
    extra.append(h('p', { class: 'quest-hint' }, h('strong', {}, 'Hint: '), q.hint), h('p', { class: 'quest-formula' }, h('code', {}, q.formula)));
  };

  const form = h('form', { class: 'quest-form' },
    h('label', { for: 'input-quest-answer' }, 'Your answer'),
    h('div', { class: 'quest-row' }, input, h('span', { id: 'quest-unit', class: 'quest-unit' }, q.unit), check));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (solved) return;
    const r = checkAnswer(q, input.value);
    feedback.className = `quest-feedback quest-feedback--${r.status}`;
    if (r.status === 'invalid') { feedback.textContent = `Type a number, in ${q.unit}.`; return; }
    if (r.status === 'correct') {
      solved = true;
      feedback.textContent = 'Correct.';
      showExplanation('Why:');
      input.setAttribute('readonly', '');
      check.setAttribute('disabled', '');
      onSolved();
      return;
    }
    tries++;
    feedback.textContent = `Not quite: ${r.value.toLocaleString('en-US')} ${q.unit} is too ${r.direction}. Try again.`;
    if (hintsEnabled && tries === 1) showHint();
    if (tries >= TRIES_BEFORE_REVEAL && !extra.querySelector('.quest-reveal')) {
      const reveal = h('button', { type: 'button', class: 'quest-reveal' }, 'Show the worked answer');
      reveal.addEventListener('click', () => showExplanation('Worked answer:'));
      extra.append(reveal);
    }
  });

  const hintBtn = hintsEnabled ? h('button', { type: 'button', id: 'btn-quest-hint', class: 'quest-hint-btn' }, 'Hint') : null;
  hintBtn?.addEventListener('click', showHint);

  dialog.append(
    h('header', { class: 'quest-head' }, h('h3', { id: 'quest-title' }, q.title), close),
    h('p', { class: 'quest-prompt' }, q.prompt),
    form, feedback, ...(hintBtn ? [hintBtn] : []), extra,
  );
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  input.focus();
}
