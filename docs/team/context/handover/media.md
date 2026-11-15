# Handover — Media (UX)

Newest block on top. One block per session. Other roles write in their own files, never here (D-015, D-107).

---

## 2026-11-15 12:10 — NASA-term colour on the console (D-302)

**Landed on `ux/mcr`:** the stage-track codes (MCR SRR PDR CDR FLY) in `.console-bar` and the bracketed acronym in the stage title are soft orange `--nasa-term` #FFA94D, 12px IBM Plex Mono uppercase. Files: `src/styles.css` (tokens `--nasa-term` and `--term-font`; `.track-code` rule; `.phase-title .nasa-term`; locked pills at 60 % opacity), `src/ui/CockpitHUD.ts` (`phaseTitleNodes` wraps the acronym in a span; textContent is unchanged so the e2e title assertions still pass), `index.html` (one more `@font-face`), `public/assets/fonts/IBMPlexMono-latin-400.woff2` + `OFL-IBMPlexMono.txt` (14 KB, latin subset from Google Fonts, OFL 1.1), `docs/team/context/MEDIA.md`.

**Judgment calls:** the design brief named #00BFFF / #22C55E / #94A3B8 for current / passed / locked names and #FF6B35 for problems. The console actually uses `--accent` #4ea8ff, `--ok` #3ddc84, `--muted` #8592a3, `--warn` #ffb020, `--fail` #ff4d4f (those brief colours are the landing-page palette). Kept the console's own colours, per "keep their current colors". The 60 % locked-pill opacity did not exist before; added because the brief relies on it to dim the code. The old `.track-code` had `opacity: .7` in every state; removed, since the brief wants the code at full colour unless the pill is locked.

**Open:**
- `src/ui/CockpitHUD.ts` is the Architect's file (one helper added, two `h2` call sites changed). Announce in team chat before the PR.
- Palette: the brief and the console disagree. Decide whether the console moves to the landing-page palette; that is a separate PR touching `src/styles.css` tokens only.
- `--warn` #ffb020 (About page provisional tiers, wrong side-quest answers) is close to the new orange. Not on the console header, but check if the two ever share a screen.

---

## 2026-11-14 23:35 — Landing page (D-301)

**Landed on `ux/home`:** the home page at `/`, ported from the Stitch mockup (`html-things/`, kept untracked). Files: `src/ui/home/{HomeView.ts, home.css, starfield.ts, uiConfig.ts}`, `public/config/ui-config.json`, `public/assets/images/home-hero.jpg`, `tests/home.e2e.spec.ts`. `src/main.ts` now routes `#mission` and `#design=` to `startConsole()` (the old cockpit block, moved out of `boot()` unchanged) and everything else to the home page. The ten `page.goto('/')` calls in the two e2e files became `page.goto('/#mission')`.

**How to change the words:** edit `public/config/ui-config.json`, no code change. `game_name` is "ZAP ZAP ZAP" until the team decides. An empty `nav.demo_video_url` hides the Demo link. `starfield.mode` is `twinkle`, `static` or `off`. An empty `hero_image.path` hides the picture and its caption.

**Open:**
- Fonts (done 11-15): Exo 2 is the landing page default, self-hosted in `public/assets/fonts/` with its OFL licence. Doto is downloaded and registered as `--home-font-special` but unused until Media says where.
- The hero picture is the 512×286 Stitch export; replace it with a sharper file if one exists, keep the caption.
- Card copy ("5 m lunar elevation maps", "true Earth positions from JPL") must match what the About page lists as used before submission.
- Architect and Lead: `src/main.ts` and the two e2e files were touched (announce in team chat before the PR). Lead to add `#mission` to BUILD-PLAN §6 routes.
- Back from `#mission` leaves the site (one-way `replaceState`); acceptable for now.
