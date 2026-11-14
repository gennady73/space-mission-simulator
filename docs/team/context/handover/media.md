# Handover — Media (UX)

Newest block on top. One block per session. Other roles write in their own files, never here (D-015, D-107).

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
