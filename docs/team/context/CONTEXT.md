# CONTEXT — current mission state

> Core Triad: load this file together with `docs/space-mission-simulator-implementation-specification-final-v2.md`, `docs/BUILD-PLAN.md` (errata to the spec) and `public/config/engine-constants.json`.
> Update this file at every stage transition: what changed, what's green, what's blocking.

**Updated:** 2026-11-14 ~17:40 IST by Lead (Claude, Lead instance)
**Event clock:** NASA Space Apps, Sat 14 – Sun 15 Nov 2026 · **Cut line: Sun 12:00** · Challenge: *Space Mission Design Game*

## Project lifecycle phase (our own NPR 7120.5 analogue)

| Gate | Meaning for us | Status |
|---|---|---|
| MCR | Concept agreed (spec v2) | ✅ |
| SRR | Requirements + challenge coverage (BUILD-PLAN §1) | ✅ |
| PDR | Contracts frozen: `Interfaces.ts` + `engine-constants.json` | ✅ v1.0.0 |
| CDR | Playable cockpit, all Must items | ⏳ **current** |
| PLAR | Deployed on GitHub Pages + submission | ☐ |

## Green
- The engine runs end to end: constants → gates → 8,760 h simulation → score. Type-checks clean.
- 15 design scenarios verified (BUILD-PLAN §4). The reference design scores 816, and five different designs win.
- Unit tests pass on the Lead's machine (18/18, vitest). E2E suite runs separately under Playwright (two UI tests are `fixme` until the cockpit exists).
- V-01 done: PDR margins now GSFC-STD-1000 Rule 1.06 (15% power, 10% mass); STMD ranks and need IDs verified (D-021, D-022).
- Placeholder fallbacks work with zero media files.

## Open / blocking
1. **Cockpit UI** (Architect): Must items in BUILD-PLAN §3. Nothing is blocking this.
2. **NASA data:** organiser question sent 5 Nov and settled. LOLA / Diviner / Horizons processing is a Could item; the game ships on the synthetic site model until then.
3. **Repo push:** the Lead's Claude cannot push (GitHub App not installed). It edits the Lead's local clone; the Lead commits and pushes.

## Next immediate gate hurdle
CDR: a player can go Objective → MCR → SRR → PDR → CDR → run → debrief in the browser, entirely on screen choices.
