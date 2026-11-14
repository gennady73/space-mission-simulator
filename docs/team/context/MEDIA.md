# Media Registry

Media arrives late (final stage). Code never waits for it: every placeholder renders a text fallback when its file is missing (REQ-011).
To add art, drop the file at the path below. No code change is needed. To hide all art: `system_constants.enable_graphic_placeholders = false`.

| ID | Stage | File (under `public/`) | Ratio | Target px | Concept | Fallback badge | Status |
|---|---|---|---|---|---|---|---|
| IMG-PLACEHOLDER-INTRO | INTRO | assets/images/placeholders/intro-hero.svg | 16:9 | 1280×720 | 2032: cargo lander arriving at the south pole, Earth low over sunlit rims | [NARRATIVE BRIEFING: 2032 POLAR OUTPOST PIONEER] | ☐ |
| IMG-PLACEHOLDER-STAGE-1 | MCR | assets/images/placeholders/stage1-mcr-site.svg | 21:9 | 1680×720 | Grazing sub-2° light on rims; black cold-trap floors | [STAGE 1 · MCR · SITE SELECTION] | ☐ |
| IMG-PLACEHOLDER-STAGE-2 | SRR | assets/images/placeholders/stage2-srr-plume.svg | 21:9 | 1680×720 | Plume scouring bare regolith vs 45° deflectors throwing it up | [STAGE 2 · SRR · PLUME & PAD] | ☐ |
| IMG-PLACEHOLDER-STAGE-3 | PDR | assets/images/placeholders/stage3-pdr-power.svg | 21:9 | 1680×720 | 10 m vertical mast in sunlight; battery carrying the shadow | [STAGE 3 · PDR · POWER] | ☐ |
| IMG-PLACEHOLDER-STAGE-4 | CDR | assets/images/placeholders/stage4-cdr-coldtrap.svg | 21:9 | 1680×720 | Laser beam + HTS maglev rail descending into a 40 K crater | [STAGE 4 · CDR · COLD TRAP] | ☐ |
| IMG-PLACEHOLDER-STAGE-5 | PLAR | assets/images/placeholders/stage5-plar-timeline.svg | 21:9 | 1680×720 | Earth bobbing above/below the horizon over a year | [STAGE 5 · PLAR · 365-DAY RUN] | ☐ |
| IMG-PLACEHOLDER-END | DEBRIEF | assets/images/placeholders/debrief-outpost-hero.svg | 16:9 | 1280×720 | Full outpost panorama; success/failure overlay drawn by code | [MISSION DEBRIEF] | ☐ |
| TEAM-EMBLEM | README / About | assets/images/eleven-two-emblem.png | 16:9 | — | Team emblem | — | ✅ in repo |

Formats: SVG preferred; PNG/WebP accepted (update `asset_path` in constants). Keep each file under 400 KB.
Rights: only original work, NASA imagery (credit it in About), or licensed art. No real people, no third-party characters or logos.
**Space Apps rules (submission guide):** any AI-generated image or video must carry a **visible "AI-generated" watermark**; do not use or modify NASA branding (no NASA logo or meatball). The demo video is ≤ 30 s with English subtitles (shot list in `event/SUBMISSION.md`).
