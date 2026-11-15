# Handover — Media (UX)

Newest block on top. One block per session. Other roles write in their own files, never here (D-015, D-107).

---

## 2026-11-15 ~15:45 — Sticky notes (D-304), branch `ux/sticky-notes` on top of `ux/minimal-console`, not pushed

**Component:** `src/ui/StickyNote.ts` (`renderStickyNote({ kind, title, body, footer?, onClose?, class? })`, `stickyIcon(kind)`), `src/ui/sticky-notes.css`. Kinds: success #39D98A +1°, mistake #EF4444 −2° (role alert), tip #FFD43B −1° (role status). Ink #080F1E; contrast 10.45:1, 5.09:1, 13.42:1. Tokens `--note-success`, `--note-mistake`, `--note-tip`, `--note-ink` added to `:root` in `src/styles.css`. **DESIGN.md** (`html-things/DESIGN.md`, the Stitch export) does not list any of the three fills; all three are new to it, and #EF4444 and #39D98A are new to the repo (#FFD43B was already `--home-narrator`).

**Where the notes are used:**
- Quest dialog, `src/ui/SideQuestModal.ts`: hint = tip ("Hint", formula in mono as footer, closable); wrong = mistake ("Not quite yet.", footer "Try the hint." while hints are on and unseen); correct = success ("Correct.", explanation as body, `.quest-explanation` kept); worked answer = tip ("Worked answer"). One slot, one note at a time; an invalid entry stays the inline line. The hint no longer opens by itself after the first miss (it would hide the mistake note); the footer offers it. D-101 said "a hint appears after the first miss": now it is offered, one press away. Revert by restoring the `tries === 1` line if the Lead prefers.
- "Want to know more?" row `#btn-quests`: a 30×26 yellow tab with the brain at the left end; row still 40 px. Its popover holds one yellow note (title "Want to know more?", the invitation, then the quest buttons after the divider, styled ink-on-paper). The note's close closes the popover; the row reopens it.
- Review verdicts, `renderGateBanner` in `src/ui/DebriefView.ts` (Architect's file): failed gate = mistake note with "What to change: …" and the standard · reason code after the divider; passed gate = success note. On the panel the failed note has a close (`dismissBanner` action, `src/main.ts` + `CockpitActions`); a new failed review brings a new note; any design change clears it (existing behaviour). The review modal and the debrief render the same notes without a close. Old `.gate-*-banner` rules in `styles.css` are scoped to `:not(.sticky)` for the fatal-load box only.
- Design check page: `http://localhost:5173/#notes` (`src/ui/StickyNoteShowcase.ts`, routed in `src/main.ts` like `#map`). Sample copy from the mockup. Safe to delete after the event.

**Verified:** typecheck; 39 unit; 18 e2e (one new: a failed review leaves a dismissable alert note on the panel). Screenshots at 1280×720: the quest dialog never scrolls in any note state (tallest 477 px), the panel overflow is unchanged, the row is 40 px.

**Second brief, what was not done and why:** `references/notes-design.html` and `notes-screenshot.png` do not exist on this machine; the only reference is `Desktop/NASA/refs/think about it.png` (380 px wide), so typography and the brain icon are drawn to match that image, not extracted from HTML. The app's real error surfaces are the four review gates plus PLAR (all now notes) and the quest entry; the resource tiles' "Problem:" lines are budget readouts, not errors, and were left alone. No global error interception. The component API keeps `kind`/`body` (first brief) rather than `variant`/`description`/`isOpen`; `isOpen` is unnecessary in this DOM-builder code (render or do not). Tilts follow the first brief (mistake −2°), not the second's "about +1°".

**Open:** Architect's files touched again (`CockpitHUD.ts`, `DebriefView.ts`, `main.ts`), Lead's `SideQuestModal.ts`; tell the Lead. The team may want D-101's auto-hint back. The `#notes` page can go after the event.

---

## 2026-11-15 ~15:10 — Minimal console (D-303), branch `ux/minimal-console`, not pushed

**Landed, one commit per step, typecheck + 39 unit + 17 e2e green after each:**
1. `src/ui/popover.ts` (new) and `choices()` in `src/ui/CockpitHUD.ts`: one row per option (name + "i"), popover with name, stats, description; `.choice-row`, `.info-btn`, `.popover` in `src/styles.css`.
2. `siteCard()` in `CockpitHUD.ts`: one landing-site card at MCR, `#site-card`, `#select-site` (keyboard equivalent of the canvas pins), `#btn-site-clear`; `src/main.ts` map click now checks `lockFor(c, state, 'landing site')`; tests pick the site with `selectOption('#select-site', …)`.
3. `renderGroups()` / `group()` in `CockpitHUD.ts`: collapsible groups, one open at a time, module-level `openGroup` (presentation only); number fields as single rows.
4. `briefingLine()` in `CockpitHUD.ts` (replaces `renderPlaceholder` for INTRO on the console); objectives note behind an "i"; `#objectives-status` moved into `.panel-submit .submit-row`; `renderSideQuests()` in `src/ui/SideQuestModal.ts` is one row `#btn-quests` + popover; `src/ui/side-quests.css`; `tests/side-quests.e2e.spec.ts` opens the row first.
5. Measurement (below), this block, DECISIONS D-303, MEDIA.md row for the INTRO slot.

**Judgment calls, revert any of them by dropping the commit:**
- After a single-choice pick, the next group that still needs a choice opens and takes focus (the brief said only "one open at a time"). Without it the player, and the e2e flows, would click a header before every choice.
- D-034 touch points: the "estimated from the reference design" note is still in the checklist but behind an "i"; `#objectives-status` keeps its id and text but sits beside the submit button. Ids `#objectives`, `#objective-<key>`, `data-done` unchanged.
- The INTRO art slot is no longer rendered on the console; the briefing is text from `graphic_placeholders.IMG-PLACEHOLDER-INTRO` (title, brief_explanation, badge). The END card and About page still use `renderPlaceholder`.
- Keyboard: the map is a canvas, its pins cannot take focus, and `src/ui/map/SiteMap.ts` is the Lead's file under active change today. I kept an equivalent control (`#select-site`) instead of making the canvas keyboard-operable.
- The map click did not respect the team-play lock; fixed in `main.ts` (two lines). Reading ("i" buttons, group headers) always works for a locked seat.

**Overflow of `.console-panel` after step 4 (px over its height; 0 = no scrollbar):**

| viewport | MCR empty | MCR chosen | SRR | PDR | CDR |
|---|---|---|---|---|---|
| 1440×900 (panel 769 px) | 0 | 0 | 0 | 31 | 0 |
| 1280×720 (panel 589 px) | 0 | 83 | 127 | 211 | 0 |

Nothing chosen vs everything chosen gives the same number at SRR/PDR/CDR: one group is always open, and the collapsed headers (44 px + 16 px gap each) dominate.

**What takes the height at PDR, 1280×720 (589 px available, 800 px used):** stage title 26 · Think-first row 50 · objectives 160 (heading row + 4 lines) · five group headers + the open group 374 · quests row 42 · submit bar 70 · panel gaps 6 × 12 = 72.

**Options, not implemented (rough savings at PDR):**
1. Gaps: `.console-panel` gap 12→8 and `.panel` gap 16→8, about 60 px. Pure spacing.
2. Collapsed header 44→36 px: about 40 px. Still above the 32 px touch minimum but below D-033's 40 px rule for controls.
3. Objectives fold to one row once every item is done ("4 of 4 chosen ✓"): about 100 px, only in the chosen state.
4. Think-first row hidden once answered (the answer stays reachable from the title row): 50 px.
5. MCR card: move the site description into the card's "i" popover: about 50 px in the chosen state.
Options 1 + 2 fix 1440×900 PDR and 1280×720 MCR/SRR; PDR at 1280×720 also needs 3 and 4, or a smaller resource bar in the header (outside this brief).

**Slope reveal, report only:** the map hides the slope until the lidar is chosen (`available()` in `src/ui/map/SiteMap.ts`, line ~129: `slope: !strict() || selectedInstruments.includes('ndl')`, where `strict` is `difficulty_levels[difficulty].sensor_gating_strict`). The site card's stats line (`siteStats()` in `CockpitHUD.ts`) always shows "Slope X°", as the five cards did before. Recommendation: the card should follow the same rule, otherwise the map's "Slope unknown: add the lidar" is contradicted one panel over. The clean way is to lift `available()` into a tiny shared helper (e.g. `src/ui/sensorGating.ts`) used by both; Lead's call, since the rule is in the map.

**Open:** `CockpitHUD.ts` and `main.ts` are the Architect's files and `SideQuestModal.ts` is the Lead's; the Lead covers the Architect today, so tell the Lead before the PR. Branch is local only.

---

## 2026-11-15 12:10 — NASA-term colour on the console (D-302)

**Landed on `ux/mcr`:** the stage-track codes (MCR SRR PDR CDR OPS) in `.console-bar` and the bracketed acronym in the stage title are soft orange `--nasa-term` #FFA94D, 11px IBM Plex Mono uppercase. Files: `src/styles.css` (tokens `--nasa-term` and `--term-font`; `.track-code` rule; `.phase-title .nasa-term`; locked pills at 60 % opacity), `src/ui/CockpitHUD.ts` (`phaseTitleNodes` wraps the acronym in a span; textContent is unchanged so the e2e title assertions still pass), `index.html` (one more `@font-face`), `public/assets/fonts/IBMPlexMono-latin-400.woff2` + `OFL-IBMPlexMono.txt` (14 KB, latin subset from Google Fonts, OFL 1.1), `docs/team/context/MEDIA.md`.

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
