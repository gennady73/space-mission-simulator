# Space Apps submission — draft (Lead)

Paste each section into the matching field of the Space Apps project submission form. Everything must be in English.
Rules checked against the official guide (spaceappschallenge.org/resources/project-submission-guide):
- **Demo:** a video of **at most 30 seconds, with English subtitles**, or **at most 7 slides**, at a public link. YouTube, Drive or GitHub are fine; the link must not need a password or registration.
- **Final project:** a public link.
- **AI:** disclose AI use. AI-made images or video need a **visible watermark**; AI-written code or data must be acknowledged in text and metadata. Don't use or modify NASA branding.
- **Deadline:** the guide shows last year's dates. Check the deadline for our local event in the form itself. The team's own cut line is **Sun 15 Nov 12:00**.

---

## Project name
Polar Outpost Pioneer

## High-level project summary
Polar Outpost Pioneer is a browser game in which players design, review and fly a robotic outpost at the Moon's south pole, the way NASA designs missions. Players choose a landing site, launcher, landing pad, power mast, batteries, communications, data storage, cold-trap logistics and instruments while watching mass, power, budget, data, communications and time. Each design must pass NASA-style reviews (MCR, SRR, PDR, CDR) that check real constraints, then survives, or doesn't, a year simulated hour by hour. Failures are explained, not just scored. Up to four players can share a mission, each owning one NASA mission segment and signing off its own review. Every number is listed with its source, so players learn real trade-offs from checkable facts.

## Link to project demo
<!-- paste the public 30-second video (with English subtitles) or the slide link -->

## Link to final project
- Play: https://gennady73.github.io/space-mission-simulator/
- Code: https://github.com/gennady73/space-mission-simulator

## Detailed project description

**What it does.** The game turns the challenge's trade-offs into one connected mission:
1. **Think first.** Each stage opens with a question. The player writes a hypothesis before the game explains the physics (for example, why permanently dark craters sit next to peaks of almost constant sunlight).
2. **Design.** Every choice moves several resources at once. An always-visible bar shows mass against the launcher, the battery margin through the longest shadow, budget, data generated, data sent home, and mission time.
3. **Reviews.** Four gates check real constraints:
   - **MCR:** landing slope and Earth visibility.
   - **SRR:** plume standoff, and wet mass and fairing against the launcher.
   - **PDR:** battery margin through the longest shadow, using NASA Goddard's **GSFC-STD-1000 Rule 1.06** 15% power margin.
   - **CDR:** heater power in a 40 K crater, route slope and power-link range.

   A failed gate says which check failed, why, and what to change.
4. **Fly.** A deterministic 8,760-hour simulation models sunlight and shadow, battery charge, Earth line of sight, buffered science data and water ice extracted, with seeded random events (dust, cable snags, rover wear).
5. **Debrief.** The player gets a score (reviews passed, science return, budget left, data completeness), telemetry charts, the year's events, the cause of any failure, and badges tied to NASA's FY26 technology shortfalls.

**There is no single right answer.** Five quite different designs complete the mission (for example, a sunlit-ridge outpost with a superconducting maglev, or a rover-based outpost at a gentler site with a fuel cell). Each "obvious" shortcut fails at the review that names it. A battery that looks big enough actually passes the year but fails PDR, which teaches why margins exist.

**Team play.** Up to four seats share one screen and one budget: Mission Lead (User segment), Launch & Structures, Power & Thermal, and Comms & Science. Each seat can change only its own decisions and only the review owner can sign off, so priorities have to be negotiated. Designs can be exported and shared by link to compare.

**Learning.** Hypothesis-first questions, plain-language failure messages, and optional *"Want to know more?"* calculations (battery sizing, the 15% margin rule, data-buffer size, laser power beaming, plume standoff) with answers checked on the spot. Three difficulty levels: Cadet, Engineer and Flight Director.

**Why it is credible.**
- Every one of the 246 numbers lives in one file, with its source and a tier: NASA document, physical constant, literature, provisional, or game rule.
- An *About & Numbers* page shows them all, and an automated test fails the build if any number lacks a source.
- NASA citations were checked against the documents. Writing this game corrected two errors in our own early design notes: the margin rule number, and a shortfall need number.

**How it is built.**
- TypeScript and Vite, with no server and no framework.
- A pure, deterministic engine, so the same design always gives the same mission.
- SVG telemetry charts.
- Vitest unit tests and Playwright browser tests.
- Deployed by GitHub Actions to GitHub Pages; runs offline once loaded.

**Goals and impact.** Students rarely see a whole mission, from objective to operations, in one place. This game lets them break a mission and learn from why it broke, in about 15 minutes per run, using the same review vocabulary and margin rules NASA engineers use.

## NASA data
The game is built on NASA documents (below) and on four processed NASA datasets — terrain, temperatures and illumination (listed under Space Agency Partner & Other Data).
- **Design and Develop Science Missions** (NASA, challenge resource): the four mission segments (Launch, Space, Ground, User) are the game's structure, and the team-play seats.
- **GSFC-STD-1000 Rev I, Rule 1.06 Resource Margins** (NASA Goddard): the PDR power (>15%) and dry-mass (>10%) margins used by the review gate.
- **FY26 Civil Space Shortfall Prioritization** (NASA STMD): shortfall IDs, ranks and need statements cited in gate messages and end-of-mission badges.
- **NASA TechPort project 116305, Vertical Solar Array Technology:** the tall vertical solar masts that make polar power possible.
- **NASA Systems Engineering Handbook (SP-2016-6105) and NPR 7120.5:** the life-cycle phases and reviews.
- **CubeSat 101 (NASA CSLI):** plain-language mission and subsystem concepts.

## Space agency partner & other data
- **LOLA 120 m polar DEM** (LDEM_75S_120M, LRO LOLA GDR; NASA PDS Geosciences): the regional terrain the in-game map renders, plus 120 m close-ups of every landing site.
- **LOLA 5 m/px south-pole site DEMs** (NASA PGDA product 78; Barker et al. 2021): terrain within 4 km of the Shackleton connecting ridge, de Gerlache rim and Malapert massif sites.
- **LRO Diviner South Polar Resource Product v2** (NASA PDS; D. A. Paige, UCLA): annual maximum temperature and depth to stable water ice — the cold traps the map paints. The 110 K surface-ice limit follows Paige et al. 2010 (Science 330:479).
- **Lunar Polar Illumination, NASA PGDA product 69** (Mazarico et al. 2011): 60 m permanent-shadow maps drawn in the site close-ups; average sunlight and Earth visibility cross-check the site catalog (`docs/team/context/ILLUMINATION-CHECK.md`).
- All raw downloads are processed by small open scripts in `tools/data-pipeline/` into ≤4 MB of JSON served with the game; the map names its data sources on screen. The event organisers confirmed outside public data may be used with credit.
- Physical constants: NASA Moon Fact Sheet, CODATA 2018.
- Tools: TypeScript, Vite, Vitest, Playwright, GitHub Actions and GitHub Pages (all open source or free services).
- All code and text are original work of the team (with AI assistance, see below). No third-party images are used. Team emblem: own work.

## Use of AI
- The game specification was drafted with Google Gemini (NotebookLM) from the NASA documents above.
- Code, the constants file, tests and documentation were written with Anthropic Claude. Each team member worked with their own Claude session, and every change was reviewed, tested and merged by the team.
- AI-written code is acknowledged in the README and in every commit's metadata (`Co-Authored-By`).
- Every AI-produced number is labelled with its source tier on the in-game About & Numbers page, and the NASA citations were checked by hand against the documents.
- Any AI-generated image added later carries a visible "AI-generated" watermark. No NASA branding is used or modified.

---

## Demo video — 30 seconds, English subtitles (shot list)

Record the live site at 1080p. Burn in subtitles (the text below is also the voice-over). Upload as unlisted on YouTube or publicly shared on Drive.

| Time | Screen | Subtitle / voice-over |
|---|---|---|
| 0–3 s | Title card with emblem: *Polar Outpost Pioneer · Team eleven-two · Space Mission Design Game* | "Team eleven-two: Polar Outpost Pioneer." |
| 3–8 s | First screen: the "Think first" question, typing a short hypothesis, the explanation appearing | "Design a robotic Moon-base the way NASA does: questions first." |
| 8–14 s | Picking a site, launcher, mast and battery; the resource bar changing; the POWER tile turning red with a 6 kWh battery | "Every choice moves mass, power, budget, data and time." |
| 14–19 s | Submit to PDR → red banner citing *GSFC-STD-1000 Rule 1.06*; switch to 8 kWh → green | "NASA-style reviews catch weak designs, and say exactly why." |
| 19–25 s | Fly the year → debrief: telemetry charts, score, badges | "Then fly it, hour by hour, for a full year." |
| 25–30 s | Team-play seats, then the About & Numbers page scrolling | "Play as a team of four. Every number has a source. Play now: link below." |

**Seven-slide alternative:**
1. Title, team name and members, challenge.
2. The problem: trade-offs stay abstract.
3. Screenshot of the cockpit and resource bar.
4. A review failing and explaining why.
5. The year simulation and debrief.
6. Team play and learning (questions first, side-quests).
7. NASA documents used and the About & Numbers page.
