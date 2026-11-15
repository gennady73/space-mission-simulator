/**
 * Landing-page copy and settings (D-301), read from `public/config/ui-config.json`.
 * Media owns the JSON: every word on the home page lives there, so renaming the game or
 * rewriting the tagline is a JSON edit, not a code change. The type stays local to this
 * module on purpose: it is not part of the engine contract in `models/Interfaces.ts`.
 */

export type StarfieldMode = 'twinkle' | 'static' | 'off';
export type HomeIcon = 'globe' | 'scales' | 'target';

export interface UiConfig {
  schema_version: string;
  /** Placeholder until the team decides the name. Shown in the nav brand and the hero title. */
  game_name: string;
  home: {
    kicker: string;
    tagline: string;
    subtitle: string;
    cta_label: string;
    footnote: string;
    nav: {
      how_it_works: string;
      about: string;
      demo: string;
      /** Empty string hides the demo link until the video exists. */
      demo_video_url: string;
    };
    hero_image: {
      /** Relative to the site root, like `asset_path` in engine-constants.json. Empty hides the picture. */
      path: string;
      /** Space Apps rule: AI-generated images carry a visible "AI-generated" mark. */
      caption: string;
      alt: string;
    };
    starfield: { mode: StarfieldMode; star_count: number };
    /** Labels for the quieter ways in under the CTA; leave one out to hide it. */
    secondary?: { example?: string; watch?: string; team?: string };
    cards: Array<{ icon: HomeIcon; title: string; text: string }>;
    /** "How to play" section under the cards; leave it out to hide it. */
    tutorial?: {
      title: string;
      intro: string;
      steps: Array<{ tag: string; title: string; text: string }>;
      tips_title: string;
      tips: string[];
    };
    narrator_line: string;
  };
}

export const UI_CONFIG_URL = './config/ui-config.json';

export async function loadUiConfig(url: string = UI_CONFIG_URL): Promise<UiConfig> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${url}: HTTP ${res.status}`);
  return (await res.json()) as UiConfig;
}
