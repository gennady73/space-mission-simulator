# CONTEXT — current mission state

> Core Triad: load this file together with `docs/space-mission-simulator-implementation-specification-final-v2.md`, `docs/BUILD-PLAN.md` (errata to the spec) and `public/config/engine-constants.json`.
> Update this file at every stage transition: what changed, what's green, what's blocking.

**Updated:** 2026-11-14 ~17:00 IST by Lead (Claude, Lead instance)
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
- Unit tests written (`tests/margin-calculations.spec.ts`), plus an adapted E2E suite (two UI tests are `fixme` until the cockpit exists).
- Placeholder fallbacks work with zero media files.

## Open / blocking
1. **Cockpit UI** (Architect): Must items in BUILD-PLAN §3. Nothing is blocking this.
2. **V-01** (Lead): verify the GSFC-STD-1000 rule number and the STMD ranks against the PDFs.
3. **NASA data** (Lead): has the organiser approved the four data sources (spec §11)? Until then, use the synthetic site model.
4. **Repo push:** this session's Claude cannot push (GitHub App not installed for the repo). The Lead pushes the bootstrap bundle by hand.
5. `docs/space-mission-simulator-implementation-specification-final-v2.md` (and v1) still need to be copied from the Drive into `docs/` on the first push.

## Next immediate gate hurdle
CDR: a player can go Objective → MCR → SRR → PDR → CDR → run → debrief in the browser, entirely on screen choices.
