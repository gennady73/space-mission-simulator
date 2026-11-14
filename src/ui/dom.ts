/** Tiny DOM builder: text is always set as text, never as HTML. */
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

export const usdM = (usd: number): string => `$${(usd / 1e6).toFixed(1)}M`;
export const pct = (fraction: number): string =>
  Number.isFinite(fraction) ? `${(fraction * 100).toFixed(0)}%` : fraction > 0 ? 'no shadow' : 'never sunlit';
export const kg = (value: number): string => `${Math.round(value).toLocaleString('en-US')} kg`;
