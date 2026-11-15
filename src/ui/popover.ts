import { h } from './dom';

/**
 * One floating popover at a time (Media, D-303): details on demand without changing the panel's height.
 * It is anchored to its trigger, floats over the content (position: fixed, appended to body), and closes on
 * Escape, on a pointer press outside it, when another one opens, or when the cockpit re-renders.
 * The trigger carries aria-expanded / aria-controls; focus moves into the popover and returns to the trigger.
 */
type Child = Node | string | null | undefined | false;
let current: { el: HTMLElement; trigger: HTMLElement; cleanup: () => void } | null = null;
let seq = 0;

export function closePopover(restoreFocus = true): void {
  if (!current) return;
  const { el, trigger, cleanup } = current;
  current = null;
  cleanup();
  el.remove();
  trigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
}

/** Opens the popover for `trigger`, or closes it when it is already the open one. */
export function togglePopover(trigger: HTMLElement, label: string, build: () => Child[]): void {
  if (current?.trigger === trigger) { closePopover(); return; }
  closePopover(false);
  const id = trigger.getAttribute('aria-controls') || `popover-${++seq}`;
  const el = h('div', { id, class: 'popover', role: 'dialog', 'aria-label': label, tabindex: '-1' }, ...build());
  document.body.append(el);
  trigger.setAttribute('aria-controls', id);
  trigger.setAttribute('aria-expanded', 'true');
  place(el, trigger);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePopover(); };
  const onDown = (e: PointerEvent) => {
    const t = e.target as Node;
    if (!el.contains(t) && !trigger.contains(t)) closePopover(false);
  };
  const onResize = () => place(el, trigger);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onDown, true);
  window.addEventListener('resize', onResize);
  current = {
    el, trigger,
    cleanup: () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onResize);
    },
  };
  (el.querySelector<HTMLElement>('button, [href], input, select, textarea') ?? el).focus({ preventScroll: true });
}

/** Below the trigger, right edges aligned; above it when there is no room below. Clamped to the viewport. */
function place(el: HTMLElement, trigger: HTMLElement): void {
  const r = trigger.getBoundingClientRect();
  const margin = 8;
  const width = Math.min(380, window.innerWidth - 2 * margin);
  el.style.width = `${width}px`;
  const left = Math.max(margin, Math.min(r.right - width, window.innerWidth - width - margin));
  el.style.left = `${left}px`;
  const height = el.offsetHeight;
  const below = r.bottom + 6;
  const top = below + height <= window.innerHeight - margin ? below : Math.max(margin, r.top - 6 - height);
  el.style.top = `${top}px`;
}
