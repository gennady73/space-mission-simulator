import type { StarfieldMode } from './uiConfig';

/**
 * Twinkling stars behind the landing-page hero (D-301).
 * Draws only while the hero is on screen and the tab is visible, and draws a single still
 * frame when the visitor prefers reduced motion, so the page never burns battery in the
 * background.
 */

export interface StarfieldHandle { destroy(): void }

interface Star { x: number; y: number; radius: number; alpha: number; speed: number; dir: 1 | -1 }

/** Presentation only, not a mission number: how the dots look and breathe. */
const TWINKLE = {
  skyFraction: 0.7, // stars live in the top part of the hero, above the lunar horizon
  radiusMin: 0.3, radiusSpan: 1.0,
  alphaMin: 0.2, alphaMax: 0.9,
  speedMin: 0.004, speedSpan: 0.01,
  rgb: '232, 241, 248',
};

export function startStarfield(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  opts: { mode: StarfieldMode; starCount: number },
): StarfieldHandle {
  const noop: StarfieldHandle = { destroy: () => undefined };
  if (opts.mode === 'off') return noop;
  const ctx = canvas.getContext('2d');
  if (!ctx) return noop;

  let width = 0;
  let height = 0;
  let stars: Star[] = [];

  const resize = (): void => {
    width = canvas.width = host.clientWidth;
    height = canvas.height = host.clientHeight;
    stars = Array.from({ length: opts.starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * TWINKLE.skyFraction,
      radius: TWINKLE.radiusMin + Math.random() * TWINKLE.radiusSpan,
      alpha: TWINKLE.alphaMin + Math.random() * (TWINKLE.alphaMax - TWINKLE.alphaMin),
      speed: TWINKLE.speedMin + Math.random() * TWINKLE.speedSpan,
      dir: Math.random() > 0.5 ? 1 : -1,
    }));
  };

  const draw = (): void => {
    ctx.clearRect(0, 0, width, height);
    for (const s of stars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${TWINKLE.rgb}, ${s.alpha})`;
      ctx.fill();
    }
  };

  const step = (): void => {
    for (const s of stars) {
      s.alpha += s.speed * s.dir;
      if (s.alpha > TWINKLE.alphaMax) { s.alpha = TWINKLE.alphaMax; s.dir = -1; }
      else if (s.alpha < TWINKLE.alphaMin) { s.alpha = TWINKLE.alphaMin; s.dir = 1; }
    }
  };

  const onResize = (): void => { resize(); draw(); };
  resize();
  draw();
  window.addEventListener('resize', onResize);

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (opts.mode === 'static' || reduceMotion) {
    return { destroy: () => window.removeEventListener('resize', onResize) };
  }

  // Animation runs only while the hero is in view and the tab is visible; otherwise the last
  // frame stays on screen and the loop simply stops until something changes.
  let frame = 0;
  let inView = true;
  const running = (): boolean => inView && !document.hidden;
  const loop = (): void => {
    frame = 0;
    if (!running()) return;
    step();
    draw();
    frame = requestAnimationFrame(loop);
  };
  const resume = (): void => { if (!frame && running()) frame = requestAnimationFrame(loop); };
  const observer = new IntersectionObserver((entries) => {
    inView = entries.some((entry) => entry.isIntersecting);
    resume();
  });
  observer.observe(host);
  document.addEventListener('visibilitychange', resume);
  resume();

  return {
    destroy: () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      observer.disconnect();
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('resize', onResize);
    },
  };
}
