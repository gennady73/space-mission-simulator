import type { EngineConstants, GraphicPlaceholderConfig } from '../models/Interfaces';

/**
 * REQ-011: decoupled illustrative cards. If the image is missing (media arrives late) or
 * placeholders are disabled, a text fallback frame is rendered instead — never a broken image.
 * Test hook: [data-placeholder-id] and .fallback-frame h3 (tests/stage-gates.e2e.spec.ts).
 */
export function renderPlaceholder(c: EngineConstants, id: string): HTMLElement | null {
  const cfg: GraphicPlaceholderConfig | undefined = c.graphic_placeholders[id];
  if (!cfg) return null;
  const card = document.createElement('figure');
  card.className = `placeholder placeholder--${cfg.aspect_ratio.replace(':', 'x')}`;
  card.dataset.placeholderId = cfg.id;
  card.style.aspectRatio = cfg.aspect_ratio.replace(':', ' / ');

  const fallback = () => {
    card.replaceChildren();
    const frame = document.createElement('div');
    frame.className = 'fallback-frame';
    frame.innerHTML = `<span class="fallback-badge"></span><h3></h3><p></p>`;
    frame.querySelector('.fallback-badge')!.textContent = cfg.fallback_badge;
    frame.querySelector('h3')!.textContent = cfg.title;
    frame.querySelector('p')!.textContent = cfg.brief_explanation;
    card.append(frame);
  };

  if (!c.system_constants.enable_graphic_placeholders) { fallback(); return card; }
  const img = new Image();
  img.alt = `${cfg.title}. ${cfg.brief_explanation}`;
  img.src = cfg.asset_path;
  img.onerror = fallback;
  const caption = document.createElement('figcaption');
  caption.textContent = cfg.title;
  card.append(img, caption);
  return card;
}
