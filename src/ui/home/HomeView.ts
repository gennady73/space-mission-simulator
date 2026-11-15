import './home.css';
import { h } from '../dom';
import { startStarfield } from './starfield';
import type { HomeIcon, HomeTutorial, UiConfig } from './uiConfig';

/**
 * Landing page at '/' (D-301). Everything the player reads here comes from `ui-config.json`.
 *
 * One screen, no page scroll (D-305). The nav, the stars and the Moon picture stay put while the
 * middle of the hero (`.home__stage`) swaps between three views: the title block with START MISSION,
 * the "How to play" slides (one stage per slide, then the tips) and the three "How it works" cards.
 * START MISSION opens the slides so nobody misses them; "Begin mission" on the last slide and "Skip"
 * do what START did before: tear the page down and call `onStart`, and the caller mounts the cockpit.
 * Layout is the Media mockup in html-things/code.html, ported to plain CSS (no CDN: REQ-010).
 */

/** Monoline 24 px icons, 1.5 px stroke (DESIGN.md). Static strings, never config data. */
const ICONS: Record<HomeIcon, string> = {
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><ellipse cx="12" cy="12" rx="3.5" ry="9"/></svg>',
  scales: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M8 20h8M6 7h12"/><path d="M3 13l3-6 3 6a3 3 0 0 1-6 0Z"/><path d="M15 13l3-6 3 6a3 3 0 0 1-6 0Z"/></svg>',
  target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',
};

function icon(name: HomeIcon): HTMLSpanElement {
  const span = h('span', { class: 'home__icon' });
  span.innerHTML = ICONS[name] ?? '';
  return span;
}

export interface HomeHandle { destroy(): void }

/** How the visitor enters the console: their own mission, the example tour, the flown example, or team play. */
export type StartMode = 'mission' | 'example' | 'watch' | 'team';

/** A panel that takes the title block's place in the hero; `heading` receives focus when it opens. */
interface Panel { el: HTMLElement; heading: HTMLElement }

/** The "How to play" slides; `open` rewinds to the first slide, `step` moves by one. */
interface HowToPanel extends Panel { open(): void; step(delta: number): void }

export function renderHome(app: HTMLElement, ui: UiConfig, onStart: (mode: StartMode) => void): HomeHandle {
  const home = ui.home;
  const words = home.controls;

  // Background layers: stars on a canvas, then the picture with two fades into the navy.
  const stars = h('canvas', { class: 'home__stars', 'aria-hidden': 'true' });
  const sceneImage = h('div', { class: 'home__scene-image', role: 'img', 'aria-label': home.hero_image.alt });
  if (home.hero_image.path) sceneImage.style.backgroundImage = `url("${home.hero_image.path}")`;
  const scene = h('div', { class: 'home__scene' }, sceneImage, h('div', { class: 'home__scene-fade-top' }), h('div', { class: 'home__scene-fade-bottom' }));

  // Leaving for the console happens once, whichever button did it.
  let started = false;
  const start = (mode: StartMode): void => {
    if (started) return;
    started = true;
    destroy();
    onStart(mode);
  };

  // ---- View 1: the title block ----
  const cta = h('button', { id: 'btn-start-mission', class: 'cta', type: 'button' }, home.cta_label);
  // The other ways in (moved here from the console start overlay, D-113 -> D-301).
  const alt = (id: string, mode: StartMode, label: string | undefined) => {
    if (!label) return null;
    const b = h('button', { id, class: 'home__alt', type: 'button' }, label);
    b.addEventListener('click', () => start(mode));
    return b;
  };
  const alts = home.secondary
    ? h('div', { class: 'home__alts' },
        alt('btn-start-example', 'example', home.secondary.example),
        alt('btn-start-watch', 'watch', home.secondary.watch),
        alt('btn-start-team', 'team', home.secondary.team))
    : null;
  const centre = h('div', { class: 'home__centre' },
    h('p', { class: 'home__kicker' }, home.kicker),
    h('h1', {}, ui.game_name),
    h('div', { class: 'home__rule', 'aria-hidden': 'true' }),
    h('h2', {}, home.tagline),
    h('p', { class: 'home__subtitle' }, home.subtitle),
    cta,
    alts,
    h('p', { class: 'home__footnote' }, home.footnote));

  // ---- The stage: the slot the three views share, between the nav and the bottom corners ----
  const stage = h('div', { class: 'home__stage' }, centre);
  let current: HTMLElement = centre;
  /** The control that opened the current panel; focus returns to it on close. */
  let opener: HTMLElement | null = null;

  const show = (view: HTMLElement, focus: HTMLElement): void => {
    if (current !== view) { current.replaceWith(view); current = view; }
    stage.scrollTop = 0;
    focus.focus();
  };
  const closePanel = (): void => {
    document.removeEventListener('keydown', onKey);
    const back = opener ?? cta;
    opener = null;
    show(centre, back);
  };
  const openPanel = (panel: Panel, from: HTMLElement): void => {
    opener = from;
    show(panel.el, panel.heading);
    document.addEventListener('keydown', onKey);
  };
  // Escape returns to the title block from either panel; Left/Right step through the slides.
  const onKey = (e: KeyboardEvent): void => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
    if (howto && current === howto.el) {
      if (e.key === 'ArrowRight') { e.preventDefault(); howto.step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); howto.step(-1); }
    }
  };
  const backToHome = (id: string): HTMLButtonElement => {
    const b = h('button', { id, class: 'home__alt', type: 'button' }, words.back_to_home);
    b.addEventListener('click', closePanel);
    return b;
  };

  // ---- View 2: "How it works", the three cards in one row ----
  const worksHeading = h('h2', { id: 'how-it-works-title', class: 'home__section-title', tabindex: '-1' }, home.nav.how_it_works);
  const works: Panel = {
    heading: worksHeading,
    el: h('section', { id: 'how-it-works', class: 'home__panel home__works', 'aria-labelledby': 'how-it-works-title' },
      worksHeading,
      h('div', { class: 'home__grid' },
        ...home.cards.map((card) => h('article', { class: 'home__card' }, icon(card.icon), h('h3', {}, card.title), h('p', {}, card.text)))),
      h('div', { class: 'home__quiet-row home__quiet-row--centre' }, backToHome('btn-works-home'))),
  };

  // ---- View 3: "How to play", one slide at a time ----
  const howto = home.tutorial ? renderHowTo(home.tutorial) : null;

  function renderHowTo(t: HomeTutorial): HowToPanel {
    // The five stages, then the tips as one more slide.
    const slides = [
      ...t.steps.map((s) => ({ tag: s.tag, title: s.title, body: h('p', {}, s.text) as HTMLElement })),
      { tag: '', title: t.tips_title, body: h('ul', { class: 'home__tips' }, ...t.tips.map((tip) => h('li', {}, tip))) as HTMLElement },
    ];
    const total = slides.length;
    const stepOf = (i: number): string => words.step_of.replace('{n}', String(i + 1)).replace('{total}', String(total));
    let index = 0;

    const heading = h('h2', { id: 'how-to-play-title', class: 'home__section-title', tabindex: '-1' }, t.title);
    // The slide is announced as a whole each time it changes.
    const live = h('div', { class: 'home__slide', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const dots = slides.map((_, i) => {
      const dot = h('button', { class: 'home__dot', type: 'button', 'aria-label': stepOf(i) });
      dot.addEventListener('click', () => goTo(i, i < index ? -1 : 1));
      return dot;
    });
    const back = h('button', { id: 'btn-step-back', class: 'home__ghost', type: 'button' }, words.back);
    const next = h('button', { id: 'btn-step-next', class: 'cta', type: 'button' }, words.next);
    const begin = h('button', { id: 'btn-begin-mission', class: 'cta', type: 'button', hidden: '' }, words.begin_mission);
    const skip = h('button', { id: 'btn-skip-tutorial', class: 'home__alt', type: 'button' }, words.skip);
    back.addEventListener('click', () => goTo(index - 1, -1));
    next.addEventListener('click', () => goTo(index + 1, 1));
    begin.addEventListener('click', () => start('mission'));
    skip.addEventListener('click', () => start('mission'));

    const render = (dir: -1 | 1): void => {
      const s = slides[index]!;
      const body = h('div', { class: 'home__slide-body', 'data-dir': dir < 0 ? 'back' : 'next' },
        h('div', { class: 'home__slide-meta' },
          h('span', { class: 'home__step-count' }, `${index + 1} / ${total}`),
          s.tag ? h('span', { class: 'home__step-tag' }, s.tag) : null),
        h('h3', { class: 'home__slide-title' }, s.title),
        s.body);
      live.replaceChildren(body);
      dots.forEach((dot, i) => { if (i === index) dot.setAttribute('aria-current', 'step'); else dot.removeAttribute('aria-current'); });
      // One primary button at a time: Next until the last slide, then Begin mission.
      const last = index === total - 1;
      back.disabled = index === 0;
      next.hidden = last;
      begin.hidden = !last;
      // Keep the keyboard user's place when the control they were on goes away.
      const active = document.activeElement;
      if (active === next && last) begin.focus();
      else if (active === begin && !last) next.focus();
      else if (active === back && back.disabled) next.focus();
    };
    const goTo = (i: number, dir: -1 | 1): void => {
      const clamped = Math.max(0, Math.min(total - 1, i));
      if (clamped === index) return;
      index = clamped;
      render(dir);
    };

    const el = h('section', { id: 'how-to-play', class: 'home__panel home__howto', 'aria-labelledby': 'how-to-play-title' },
      heading,
      h('p', { class: 'home__tutorial-intro' }, t.intro),
      live,
      h('div', { class: 'home__slide-nav' }, back, h('div', { class: 'home__dots' }, ...dots), next, begin),
      h('div', { class: 'home__quiet-row' }, backToHome('btn-howto-home'), skip));
    render(1);
    return {
      el,
      heading,
      open: () => { index = 0; render(1); },
      step: (delta) => goTo(index + delta, delta < 0 ? -1 : 1),
    };
  }

  const openHowTo = (from: HTMLElement): void => {
    if (!howto) { start('mission'); return; }
    howto.open();
    openPanel(howto, from);
  };
  cta.addEventListener('click', () => openHowTo(cta));

  // ---- Nav: the two panel links open their panel in place; hashes stay routes (About, mission) ----
  const howLink = h('a', { href: '#how-it-works' }, home.nav.how_it_works);
  howLink.addEventListener('click', (e) => { e.preventDefault(); openPanel(works, howLink); });
  const playLink = home.tutorial ? h('a', { href: '#how-to-play' }, home.tutorial.title) : null;
  playLink?.addEventListener('click', (e) => { e.preventDefault(); openHowTo(playLink); });
  // Same tab: main.ts swaps the About page in on hashchange, and Back returns here.
  const aboutLink = h('a', { href: '#about' }, home.nav.about);
  const demoLink = home.nav.demo_video_url
    ? h('a', { class: 'pill', href: home.nav.demo_video_url, target: '_blank', rel: 'noopener' }, home.nav.demo)
    : null;
  const nav = h('header', { class: 'home__nav' },
    h('div', { class: 'home__brand' }, ui.game_name),
    h('nav', { class: 'home__links', 'aria-label': 'Site' }, howLink, playLink, aboutLink, demoLink));

  // Bottom corners of the hero: the narrator line left, the image caption right.
  const narrator = h('p', { class: 'home__narrator' }, home.narrator_line);
  const caption = home.hero_image.path && home.hero_image.caption ? h('div', { class: 'home__caption' }, home.hero_image.caption) : null;
  const hero = h('section', { class: 'home__hero' }, stars, scene, nav, stage, narrator, caption);

  app.classList.add('home-host');
  app.replaceChildren(h('div', { class: 'home' }, hero));
  const field = startStarfield(stars, hero, { mode: home.starfield.mode, starCount: home.starfield.star_count });

  const destroy = (): void => {
    document.removeEventListener('keydown', onKey);
    field.destroy();
    app.classList.remove('home-host');
    app.replaceChildren();
  };
  return { destroy };
}
