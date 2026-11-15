import './home.css';
import { h } from '../dom';
import { startStarfield } from './starfield';
import type { HomeIcon, UiConfig } from './uiConfig';

/**
 * Landing page at '/' (D-301). Everything the player reads here comes from `ui-config.json`.
 * START MISSION tears the page down and calls `onStart`; the caller then mounts the cockpit.
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

export function renderHome(app: HTMLElement, ui: UiConfig, onStart: (mode: StartMode) => void): HomeHandle {
  const home = ui.home;

  // Background layers: stars on a canvas, then the picture with two fades into the navy.
  const stars = h('canvas', { class: 'home__stars', 'aria-hidden': 'true' });
  const sceneImage = h('div', { class: 'home__scene-image', role: 'img', 'aria-label': home.hero_image.alt });
  if (home.hero_image.path) sceneImage.style.backgroundImage = `url("${home.hero_image.path}")`;
  const scene = h('div', { class: 'home__scene' }, sceneImage, h('div', { class: 'home__scene-fade-top' }), h('div', { class: 'home__scene-fade-bottom' }));

  // "How it works" cards; the nav link scrolls here without touching location.hash (hashes are routes).
  const cards = h('section', { id: 'how-it-works', class: 'home__cards' },
    h('div', { class: 'home__grid' },
      ...home.cards.map((card) => h('article', { class: 'home__card' }, icon(card.icon), h('h3', {}, card.title), h('p', {}, card.text)))),
    h('p', { class: 'home__narrator' }, home.narrator_line));

  const howLink = h('a', { href: '#how-it-works' }, home.nav.how_it_works);
  howLink.addEventListener('click', (e) => { e.preventDefault(); cards.scrollIntoView({ behavior: 'smooth' }); });
  // Same tab: main.ts swaps the About page in on hashchange, and Back returns here.
  const aboutLink = h('a', { href: '#about' }, home.nav.about);
  const demoLink = home.nav.demo_video_url
    ? h('a', { class: 'pill', href: home.nav.demo_video_url, target: '_blank', rel: 'noopener' }, home.nav.demo)
    : null;
  const nav = h('header', { class: 'home__nav' },
    h('div', { class: 'home__brand' }, ui.game_name),
    h('nav', { class: 'home__links', 'aria-label': 'Site' }, howLink, aboutLink, demoLink));

  const cta = h('button', { id: 'btn-start-mission', class: 'cta', type: 'button' }, home.cta_label);
  // The other ways in (moved here from the console start overlay, D-113 -> D-301).
  const alt = (id: string, mode: StartMode, label: string | undefined) => {
    if (!label) return null;
    const b = h('button', { id, class: 'home__alt', type: 'button' }, label);
    b.addEventListener('click', () => { destroy(); onStart(mode); }, { once: true });
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

  const caption = home.hero_image.path && home.hero_image.caption ? h('div', { class: 'home__caption' }, home.hero_image.caption) : null;
  const hero = h('section', { class: 'home__hero' }, stars, scene, nav, centre, caption);

  app.classList.add('home-host');
  app.replaceChildren(h('div', { class: 'home' }, hero, cards));
  const field = startStarfield(stars, hero, { mode: home.starfield.mode, starCount: home.starfield.star_count });

  const destroy = (): void => {
    field.destroy();
    app.classList.remove('home-host');
    app.replaceChildren();
  };
  cta.addEventListener('click', () => { destroy(); onStart('mission'); }, { once: true });
  return { destroy };
}
