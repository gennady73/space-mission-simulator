/**
 * D-009: deterministic random events. Same seed + same design = same mission, every time
 * (REQ-001 determinism; makes Playwright tests and "compare designs" meaningful).
 * mulberry32 — tiny, fast, good enough for game events.
 */
export function createPrng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
