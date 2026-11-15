import './sticky-notes.css';
import { h } from './dom';

/**
 * Sticky note (Media, D-304): the one component allowed a bright fill, a tilt and a shadow.
 * success = check in a circle, mistake = bold X in a circle, tip = outline brain with "!" and "?".
 * Meaning never rests on colour alone: every note carries its icon and its title.
 * Roles: mistake is an alert; success and tip are status messages.
 */
export type StickyKind = 'success' | 'mistake' | 'tip';

export interface StickyNoteProps {
  kind: StickyKind;
  title: string;
  body: string | Node;
  footer?: string | Node;
  onClose?: () => void;
  /** Extra class names, such as a test hook (quest-feedback--wrong). */
  class?: string;
}

/** Inline SVG, constant markup only (never user text). Height is set in CSS; width follows the viewBox. */
const ICONS: Record<StickyKind, string> = {
  success:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    + '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>'
    + '<path d="M7.5 12.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mistake:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    + '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>'
    + '<path d="M8.5 8.5l7 7m0-7l-7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
  tip:
    '<svg viewBox="0 0 38 24" aria-hidden="true" focusable="false">'
    + '<path d="M12 4c-2.5 0-4 1.5-4.5 3C5.5 7.5 4.5 9 4.5 10.5c0 1 .4 1.8 1 2.4-.6.6-1 1.5-1 2.5 0 2 1.5 3.5 3.5 3.6.4 1.2 1.6 2 3 2h1V4z'
    + 'M12 4c2.5 0 4 1.5 4.5 3 2 .5 3 2 3 3.5 0 1-.4 1.8-1 2.4.6.6 1 1.5 1 2.5 0 2-1.5 3.5-3.5 3.6-.4 1.2-1.6 2-3 2h-1V4z"'
    + ' fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
    + '<path d="M26 5v8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="26" cy="17.5" r="1.6" fill="currentColor"/>'
    + '<path d="M30.5 8.3a3 3 0 1 1 4.2 2.7c-.9.5-1.2 1-1.2 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
    + '<circle cx="33.5" cy="17.5" r="1.6" fill="currentColor"/></svg>',
};

/** The kind's icon in a span, for the note head or a small tab elsewhere. */
export function stickyIcon(kind: StickyKind): HTMLElement {
  const wrap = h('span', { class: 'sticky__icon' });
  const template = document.createElement('template');
  template.innerHTML = ICONS[kind];
  wrap.append(template.content);
  return wrap;
}

export function renderStickyNote(p: StickyNoteProps): HTMLElement {
  const note = h('aside', { class: `sticky sticky--${p.kind}${p.class ? ` ${p.class}` : ''}`, role: p.kind === 'mistake' ? 'alert' : 'status' });
  const head = h('div', { class: 'sticky__head' }, stickyIcon(p.kind), h('strong', { class: 'sticky__title' }, p.title));
  if (p.onClose) {
    const close = h('button', { type: 'button', class: 'sticky__close', 'aria-label': `Close: ${p.title}` }, '×');
    close.addEventListener('click', p.onClose);
    head.append(close);
  }
  note.append(head, h('div', { class: 'sticky__body' }, p.body));
  if (p.footer) note.append(h('div', { class: 'sticky__footer' }, p.footer));
  return note;
}
