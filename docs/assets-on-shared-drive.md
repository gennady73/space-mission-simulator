# Assets on Shared Drive: Structure, Categorization & Operational Guide

This document is the file manifest, structural map and usage guide for the team **eleven-two** workspace (NASA Space Apps 2026, challenge *Space Mission Design Game*). The workspace has two homes:

* **Google Drive** (documents, reference material, event admin): `https://drive.google.com/drive/folders/1Oyo4wHdDw22QV_dnO5wAn2nI-axQuHvB?usp=drive_link`
* **GitHub** (all code, plus a copy of every team document the build depends on): `https://github.com/gennady73/space-mission-simulator`

The goal: any human collaborator or AI session can bootstrap context, find what it needs, and keep both homes in step.

*Revised 2026-11-14 ~17:00 IST by Lead after the build bootstrap: added `BUILD-PLAN.md`, per-role handover files, the GitHub repo, corrected paths and the Core Triad.*

---

## 1. Directory Tree & Structural Mapping

The Drive root has seven top-level folders. The repository mirrors `docs/` and `public/`, and holds the code that the Drive `code/` folder only points to.

```text
Google Drive Root: NASA_SpaceApps_2026_eleven-two/ (1Oyo4wHdDw22QV_dnO5wAn2nI-axQuHvB)
├── assets-on-shared-drive.md                                             (This guide)
├── docs/
│   ├── space-mission-simulator-implementation-specification-final-v2.md   (Master game spec — baseline, not edited)
│   ├── space-mission-simulator-implementation-specification-final-v1.md   (Prior design baseline)
│   ├── BUILD-PLAN.md                                                      (Errata to v2, scope, engine↔UI contract — wins over the spec)
│   ├── nasa-data-import-and-organization-guide.md                         (ETL pipeline & organiser request — PENDING; content is in spec v2 §11)
│   ├── Polar_Outpost_Engineering_Simulator.pdf / .pptx                    (Executive slide deck)
│   └── team/
│       ├── context/
│       │   ├── CONTEXT.md                                                 (Active state & phase-gate tracker)
│       │   ├── DECISIONS.md                                               (Trade-study & decision log, append-only)
│       │   ├── MEDIA.md                                                   (Visual placeholder & graphic registry)
│       │   └── handover/
│       │       ├── lead.md                                                (Lead session log — only Lead writes here)
│       │       └── architect.md                                           (Architect session log — only Architect writes here)
│       └── roles/
│           ├── lead.md                                                    (Mission planning, budget, margins, NPR 7120.5 gates)
│           ├── architect.md                                               (TypeScript engine, ICD, Canvas UI, tests)
│           ├── hardware.md                                                (Power, thermal, plume, comms hardware, provenance)
│           └── media.md                                                   (UI/UX cockpit, Feynman & ZPD quests, art)
├── public/
│   └── config/
│       └── engine-constants.json                                          (Every number in the game + provenance)
├── materials/
│   ├── fy26-civil-space-shortfall-prioritization.pdf                      (NASA STMD technology needs)
│   ├── 250323-design-and-develop-science-mission.pdf                      (Four mission segments framework)
│   ├── NASA_TechPort-Project_116305.pdf                                   (Vertical Solar Array Technology, 10 kW)
│   ├── nasa_csli_cubesat_101_508.pdf                                      (Small satellite standards & margin rules)
│   ├── NASA_Space_Apps_Challenge-Details_published_5Nov.pdf               (Challenge statement)
│   ├── NASA_Space_Apps_Challenge-Resources_published_13Nov.pdf            (Official resources)
│   ├── eleven-two_team_emblem_16x9_hd.png                                 (Team emblem)
│   ├── mission-design-guide.md                                            (Validity rules & margin tiers)
│   ├── resources.md                                                       (Aerospace engineering bibliography)
│   ├── All-resources-list.txt                                             (Strategic web directory)
│   └── central_shared_notebook/
│       ├── 01_System_Architecture/                                        (INCOSE tree, ICD, V&V matrix)
│       ├── 02_Primary_Sources/                                            (Ground_Truth_Fact_Base.md)
│       ├── 03_Individual_Feynman_Audits/                                  (00_Feynman_Deconstruction_Template.md)
│       ├── 04_ZPD_Peer_Teaching_Logs/                                     (00_ZPD_Peer_Teaching_Log.md)
│       └── 05_ReImported_Syntheses/                                       (00_Module_Synthesis_Report.md)
├── data/                                                                  (Processed NASA JSON — mirrored to repo public/data/)
├── code/                                                                  (Pointer only: code lives on GitHub)
└── event/                                                                 (Submission artifacts, links, organiser approvals)
```

### Repository layout (GitHub)

```text
space-mission-simulator/
├── CLAUDE.md                          Bootstrap for every Claude session (read first)
├── README.md                          Product, run instructions, data credits, AI-use declaration
├── docs/                              Same files as Drive docs/ (BUILD-PLAN, team/context, team/roles, specs)
├── public/config/engine-constants.json
├── public/data/                       Processed NASA JSON (≤ 8 MB total)
├── public/assets/images/placeholders/ Late-arriving art; code falls back to text
├── src/models/                        Interfaces.ts (ICD), StateStore.ts
├── src/engine/                        Pure engine: constants loader, subsystems, stage gates, 8,760 h clock, score
├── src/ui/                            Cockpit views
├── tests/                             Vitest unit + Playwright E2E
└── tools/                             Data pipeline, one-time constants bootstrap
```

---

## 2. File Categories & Functional Roles

### 2.1 Game Design Baseline — `docs/space-mission-simulator-implementation-specification-final-v2.md`
* **Purpose:** What is being built: architecture, INCOSE requirements REQ-001…REQ-011, the 4-segment simulation (Launch, Space, Ground, User), governing equations, stage gates, catalog, pedagogy.
* **Rule:** Baseline. **Not edited during the build.** Corrections go into `BUILD-PLAN.md`.

### 2.2 Build Plan — `docs/BUILD-PLAN.md`
* **Purpose:** How the build departs from spec v2 and why. Where it disagrees with the spec, BUILD-PLAN wins.
* **Content:**
  * challenge coverage, including the gaps the spec missed (team mode for up to 4 players, difficulty levels, the launcher mass check, orbit options);
  * 13 spec errata with decision IDs;
  * Must / Should / Could scope with the **Sunday 12:00 cut line**;
  * verified engine scenarios;
  * scoring;
  * the engine↔UI contract and DOM ids.
* **Owner:** Lead.

### 2.3 Active State — `docs/team/context/CONTEXT.md`
* **Purpose:** The current snapshot: lifecycle gate, what's green, what's open or blocking, the next hurdle.
* **Cadence:** Updated at every stage transition by whoever moves the project.

### 2.4 Decision Log — `docs/team/context/DECISIONS.md`
* **Purpose:** Chronological record of settled trades, so they are not argued again. Append-only. A new row supersedes an old one; old rows are never edited.
* **Format:** `ID | Timestamp | Raised by | Decision | System & budget impact | Status`
* **IDs:** `T-xx` pre-event trades, `D-xxx` build decisions, `V-xx` items to verify against sources.
* **Key settled trades:**
  * Elevated pad with 45° deflectors: standoff falls to 600 m, from 1,800 m for a natural bowl or 1,200 m for a sintered pad. It also carries a 6 m S-band relay antenna.
  * HTS cryogenic maglev for cold-trap access: no lubricant freeze at 38 K, and it climbs 28° slopes.
  * 1,064 nm laser power beaming to the drill: 198 W delivered in the dust case, against 175 W peak demand; 3.5 km range.

### 2.5 Session Handovers — `docs/team/context/handover/<role>.md`
* **Purpose:** Continuity across human and AI shifts.
* **Rule (D-015):** **One file per role.** Each session adds its block at the top of *its own* file only (timestamp, role, what changed, verification status, next steps). This replaces the old single `HANDOVER.md`, which two committers would conflict on.

### 2.6 Role Cards — `docs/team/roles/*.md`
* **Lead:** objective, budget, margin policy, scope; owns `engine-constants.json`, BUILD-PLAN, CONTEXT and DECISIONS; signs MCR and PLAR.
* **Architect:** owns `src/`, `Interfaces.ts`, tests and CI; implements gates and the cockpit flow.
* **Hardware:** checks every mass, power, temperature and range figure against a source and page.
* **Media:** beginner experience, Feynman "questions first", ZPD side-quests, art.

### 2.7 Media Registry — `docs/team/context/MEDIA.md`
* **Purpose:** Placeholder IDs, file paths under `public/assets/images/placeholders/`, aspect ratios, concepts and text fallbacks:
  * `IMG-PLACEHOLDER-INTRO`
  * `IMG-PLACEHOLDER-STAGE-1` … `STAGE-5`
  * `IMG-PLACEHOLDER-END`
  * the team emblem
* **Rule:** Media arrives late. Code never waits for it; a missing file renders a text fallback (REQ-011).

### 2.8 Empirical Data Contract — `public/config/engine-constants.json`
* **Purpose:** The binding contract between engineering and code. **No number is hard-coded in `src/`** (REQ-003).
* **Content:**
  * physical constants: lunar gravity 1.62 m/s², solar flux 1,361 W/m², σ, ice sublimation 2.8 MJ/kg, PDR margin 20%;
  * simulation settings;
  * difficulty levels and team roles;
  * five candidate sites;
  * two trajectories;
  * the full hardware catalog: bus, launchers, pads, masts, batteries, comms, data storage, logistics, utility links, instruments;
  * graphic placeholders, five side-quests, shortfall badges.
* **Provenance:** every block carries `{source, tier}`, where tier is one of `nasa-doc`, `literature`, `physical-constant`, `spec-provisional` or `game-rule`. Game rules are never presented as NASA values. Items still to check carry `VERIFY`.
* **Owner:** Lead. A change to it updates `Interfaces.ts` in the same PR when the shape changes.

### 2.9 Reference Materials — `materials/`
* **Purpose:** Provenance only: NASA PDFs, the challenge statement and resources, the design guide, the bibliography and the Central Shared Notebook. Read, never built against directly.

### 2.10 Code — GitHub, not Drive
* All source, tests, build and deploy (GitHub Pages) live in the repository.
* The Drive `code/` folder holds no code.
* Branches are `lead/<topic>` and `arch/<topic>`, merged to `main` by PR. Run `npm run typecheck && npm test` before pushing.

---

## 3. Keeping Drive and GitHub in Step

* **GitHub is authoritative** for everything under `docs/` and `public/` once pushed. Drive holds a mirror for reading, sharing and the AI projects.
* **The Lead refreshes the Drive mirror** at each project gate (see CONTEXT.md) and before the submission.
* Drive-only material stays Drive-only: `materials/`, `event/` and the slide deck.
* Do not edit the same document in both places between refreshes. If you must edit on Drive, copy the change into the repo in the same hour.

---

## 4. The Core Triad Bootstrap Protocol

To start any engineering, review or AI programming session with zero context drift, load:

1. **`docs/space-mission-simulator-implementation-specification-final-v2.md`** (game design)
2. **`docs/BUILD-PLAN.md`** (how the build departs from the spec; wins where they differ)
3. **`docs/team/context/CONTEXT.md`** (current state and active gate)
4. **`public/config/engine-constants.json`** (empirical contract)

In the repository, `CLAUDE.md` performs this bootstrap automatically for Claude sessions.

### Standardized AI Session Directive
```text
Load docs/space-mission-simulator-implementation-specification-final-v2.md, docs/BUILD-PLAN.md, docs/team/context/CONTEXT.md and public/config/engine-constants.json. Where BUILD-PLAN and the spec disagree, follow BUILD-PLAN. Adopt the persona in docs/team/roles/<role>.md, verify the active gate in CONTEXT.md, and work strictly through engine-constants.json (no numbers in src/). Record decisions as a new row in docs/team/context/DECISIONS.md, and at the end of the session add your block to the top of docs/team/context/handover/<role>.md (your own file only).
```
