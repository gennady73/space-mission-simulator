# Media Registry

Media arrives late (final stage). Code never waits for it: every placeholder renders a text fallback when its file is missing (REQ-011).
To add art, drop the file at the path below. No code change is needed. To hide all art: `system_constants.enable_graphic_placeholders = false`.

| ID | Stage | File (under `public/`) | Ratio | Target px | Concept | Fallback badge | Status |
|---|---|---|---|---|---|---|---|
| IMG-PLACEHOLDER-INTRO | INTRO | assets/images/placeholders/intro-hero.svg | 16:9 | 1280×720 | 2032: cargo lander arriving at the south pole, Earth low over sunlit rims | [NARRATIVE BRIEFING: 2032 LIGHTHOUSE ON THE TRAIL] | ☐ · on the console this is a one-line briefing with an "i" since D-303; the art slot is unused there |
| IMG-PLACEHOLDER-STAGE-1 | MCR | assets/images/placeholders/stage1-mcr-site.svg | 21:9 | 1680×720 | Grazing sub-2° light on rims; black cold-trap floors | [STAGE 1 · MCR · SITE SELECTION] | ☐ |
| IMG-PLACEHOLDER-STAGE-2 | SRR | assets/images/placeholders/stage2-srr-plume.svg | 21:9 | 1680×720 | Plume scouring bare regolith vs 45° deflectors throwing it up | [STAGE 2 · SRR · PLUME & PAD] | ☐ |
| IMG-PLACEHOLDER-STAGE-3 | PDR | assets/images/placeholders/stage3-pdr-power.svg | 21:9 | 1680×720 | 10 m vertical mast in sunlight; battery carrying the shadow | [STAGE 3 · PDR · POWER] | ☐ |
| IMG-PLACEHOLDER-STAGE-4 | CDR | assets/images/placeholders/stage4-cdr-coldtrap.svg | 21:9 | 1680×720 | Laser beam + HTS maglev rail descending into a 40 K crater | [STAGE 4 · CDR · COLD TRAP] | ☐ |
| IMG-PLACEHOLDER-STAGE-5 | PLAR | assets/images/placeholders/stage5-plar-timeline.svg | 21:9 | 1680×720 | Earth bobbing above/below the horizon over a year | [STAGE 5 · PLAR · 365-DAY RUN] | ☐ |
| IMG-PLACEHOLDER-END | DEBRIEF | assets/images/placeholders/debrief-outpost-hero.svg | 16:9 | 1280×720 | Full outpost panorama; success/failure overlay drawn by code | [MISSION DEBRIEF] | ☐ |
| TEAM-EMBLEM | README / About | assets/images/eleven-two-emblem.png | 16:9 | — | Team emblem | — | ✅ in repo |
| HOME-HERO | HOME (landing page) | assets/images/home-hero.jpg | 16:9 | 1920×1080 (current file 512×286) | Moon surface with Earth low on the horizon, bottom 60 % of the hero behind navy fades | caption "AI-generated image" on screen (D-301) | ✅ in repo, sharper file welcome |

**Landing page text** (game name, tagline, cards, narrator line, nav labels, demo video URL, hero path and caption) lives in `public/config/ui-config.json`. Edit the JSON; no code change (D-301). Set `hero_image.path` to `""` to hide the picture.

**Fonts** (self-hosted in `assets/fonts/`, SIL Open Font License, licence files beside them; no Google Fonts at runtime, REQ-010): **Exo 2** (`Exo2-latin-wght.woff2`, variable 100–900) is the landing page's default face. **Doto** (`Doto-latin-wght.woff2`, pixel display face) is registered as `--home-font-special` and reserved; Media will say where it is used. **IBM Plex Mono** (`IBMPlexMono-latin-400.woff2`, regular 400) is the face of NASA terms on the console: the stage-track codes and the bracketed acronym in the stage title, coloured `--nasa-term` #FFA94D, 11px uppercase (D-302). That orange means "a term NASA uses" and is used for nothing else. Latin subset only.

Formats: SVG preferred; PNG/WebP accepted (update `asset_path` in constants). Keep each file under 400 KB.
Rights: only original work, NASA imagery (credit it in About), or licensed art. No real people, no third-party characters or logos.
**Space Apps rules (submission guide):** any AI-generated image or video must carry a **visible "AI-generated" watermark**; do not use or modify NASA branding (no NASA logo or meatball). The demo video is ≤ 30 s with English subtitles (shot list in `event/SUBMISSION.md`).
