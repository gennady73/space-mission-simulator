import { h } from './dom';
import { renderStickyNote } from './StickyNote';

/**
 * Design check page at #notes (Media, D-304), like the Lead's #map: the three kinds side by side.
 * The copy is the mockup's sample text, not game text; the game's notes take their words from the
 * gate messages and the quest constants.
 */
export function renderStickyShowcase(root: HTMLElement): void {
  root.replaceChildren(h('main', { class: 'notes-showcase' },
    h('h1', {}, 'Sticky notes'),
    h('p', { class: 'hint' }, 'Design check page. Sample copy from the mockup; the game uses its own text.'),
    h('div', { class: 'notes-showcase__grid' },
      renderStickyNote({ kind: 'success', title: 'Nice call.', body: 'The battery now covers the longest night. Night energy is 14.0 of 14.0 kWh.', footer: 'Next: choose your instruments.' }),
      renderStickyNote({ kind: 'mistake', title: 'That won’t survive.', body: 'Night energy is 0 of 14.0 kWh. The station goes dark for 100 hours.', footer: 'Fix it: add a battery or switch on Hibernate.', onClose: () => undefined }),
      renderStickyNote({ kind: 'tip', title: 'Think about it.', body: 'Hibernate cuts the load from 140 W to 40 W, but there is no contact in the dark.', footer: 'Real landers do this, kept warm by radioisotope heaters.', onClose: () => undefined }),
    ),
    h('p', { class: 'hint' }, 'success tilts +1°, mistake −2°, tip −1°. Text #080F1E on #39D98A (10.5:1), #EF4444 (5.1:1), #FFD43B (13.4:1).')));
}
