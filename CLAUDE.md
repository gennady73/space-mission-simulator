# CLAUDE.md — bootstrap for every Claude session on this repo

Team **eleven-two**, NASA Space Apps 2026, challenge *Space Mission Design Game*.
Product: **Polar Outpost Pioneer**, a client-only TypeScript/Vite game in which the player designs a robotic Lunar South Pole outpost, passes NASA review gates (MCR → SRR → PDR → CDR) and runs it for 8,760 hours.
Four humans commit here, each with their own Claude: **Lead**, **Architect**, **Hardware** (mechanic / systems engineer) and **Media** (UX). Roles and ranges: D-107.

## Core Triad (load first, every session)
1. `docs/space-mission-simulator-implementation-specification-final-v2.md` — the game design (baseline, do not edit)
2. `docs/BUILD-PLAN.md` — **how the build departs from the spec** (errata, scope, engine↔UI contract). Where it disagrees with the spec, BUILD-PLAN wins.
3. `docs/team/context/CONTEXT.md` — current state and next hurdle
4. `public/config/engine-constants.json` — every number in the game (the contract)

Then adopt your role card: `docs/team/roles/<lead|architect|hardware|media>.md`.

## Map
```
public/config/engine-constants.json   numbers + provenance (Lead owns)
public/data/                          processed NASA JSON (≤ 8 MB total)
public/assets/images/placeholders/    late-arriving art; code falls back to text
src/models/Interfaces.ts              ICD — all types (Architect owns)
src/models/StateStore.ts              immutable store, export/import/share
src/engine/                           pure engine: loader, subsystems, gates, 8,760 h clock, score
src/ui/                               cockpit views (to build)
tests/                                vitest unit + Playwright e2e
tools/                                data pipeline + one-time constants bootstrap
docs/team/context/                    CONTEXT, DECISIONS, MEDIA, handover/<role>.md
```

## Rules
- **No numbers in `src/`.** Read them from constants (REQ-003). New constant → Interfaces + JSON + a DECISIONS row, all in one PR.
- **Engine is pure.** No DOM in `src/engine/`.
- **Branches:** `lead/<topic>`, `arch/<topic>`, `hw/<topic>`, `ux/<topic>` → PR to `main`. Small PRs. Pull often. The Lead merges.
- **Who edits what:** `src/engine` + `src/ui` (except `src/ui/map`) = Architect · `src/ui/map`, `tools/`, `map_features` = Lead · `hardware_catalog`, `site_catalog`, `simulation.*` values + their provenance = Hardware (PR, Lead reviews) · text the player reads (questions, gate messages, debrief wording), `MEDIA.md`, `public/assets/` = Media. Touch someone else's area only by asking in the team chat first.
- **Decision IDs:** Architect D-032+, Lead D-101+, Hardware D-201+, Media D-301+ (D-102, D-107).
- **Logs:** record decisions in `docs/team/context/DECISIONS.md` (append a row; next free ID). At session end, add a block to **your own** `docs/team/context/handover/<role>.md`. Never edit another role's handover file.
- **Facts vs rules:** every constant has `provenance` with a tier. Never present a `game-rule` as a NASA value.
- **Before pushing:** `npm run typecheck && npm test`.
- Media lands late. Never block on art.

## Commands
`npm install` · `npm run dev` · `npm run typecheck` · `npm test` · `npm run test:e2e` · `npm run build`
