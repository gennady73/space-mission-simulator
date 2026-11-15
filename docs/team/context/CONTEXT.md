# CONTEXT — current mission state

> Core Triad: load this file together with `docs/space-mission-simulator-implementation-specification-final-v2.md`, `docs/BUILD-PLAN.md` (errata to the spec) and `public/config/engine-constants.json`.
> Update this file at every stage transition: what changed, what's green, what's blocking.

**Updated:** 2026-11-15 ~12:55 IST by Lead (Claude, Lead instance)
**Team:** four roles again from Sunday morning (Media and Hardware active; Architect away, the Lead's Claude covers Architect files and logs it in DECISIONS)
**Event clock (Sun 15 Nov):** work until 12:45 · lunch · work 14:00-16:45 · **feature freeze 16:00** · **pitch 17:00** (4 min + 2 min questions) · last submissions 20:00-22:00 · **cut line 22:00**
**Product name:** *Lighthouse on the Trail* (was Polar Outpost Pioneer)

## Project lifecycle phase (our own NPR 7120.5 analogue)

| Gate | Meaning for us | Status |
|---|---|---|
| MCR | Concept agreed (spec v2) | ✅ |
| SRR | Requirements + challenge coverage (BUILD-PLAN §1) | ✅ |
| PDR | Contracts frozen: `Interfaces.ts` + `engine-constants.json` | ✅ v1.0.0 |
| CDR | Playable cockpit: a full mission on screen | ✅ (Architect, D-023–D-026) |
| PLAR | Deployed on GitHub Pages + submission | ⏳ **current** |

## Green
- The engine runs end to end: constants → gates → 8,760 h simulation → score. Type-checks clean.
- 15 design scenarios verified (BUILD-PLAN §4). The reference design scores 816, and five different designs win.
- Cockpit playable end to end: Concept (MCR) → Landing (SRR) → Power (PDR) → Ice (CDR) → Operations year → debrief → revise; team hot-seat mode; difficulty; export and share link.
- Tests: 39 unit (vitest) pass; end-to-end (Playwright) run on the Lead's machine.
- Side-quests: five optional calculations in SRR, PDR and CDR, answers checked inline (D-101).
- V-01 done: PDR margins now GSFC-STD-1000 Rule 1.06 (15% power, 10% mass); STMD ranks and need IDs verified (D-021, D-022).
- **Live:** https://gennady73.github.io/space-mission-simulator/ (GitHub Pages, redeploys on every merge to `main`, D-103).
- Hypothesis card on every phase (Architect D-031).
- Placeholder fallbacks work with zero media files.
- About & Numbers page built (`src/ui/AboutNumbersView.ts`, open at `#about`): model scope, all 246 numbers with source and tier, credits, AI-use declaration. Provenance coverage is unit-tested (D-027).

## Open / blocking
0. **State at 12:55:** landing page (Media, D-301) is the front door; real NASA terrain, cold traps and permanent shadow are on the map (D-108-D-118); Hardware's three pendings are decided (D-119); the last stage is now **Operations (OPS)** with a square map and live year charts (D-120, PR open).
1. **14:00-16:00, last feature work:** Power stage (mast position should be a real choice), Ice stage (ice is sunlit hours x a constant rate, so the stage has no trade-off; proposal on the table: night drilling on battery as a player choice), further map polish.
2. **16:00-16:45, pitch prep:** re-record the 30 s demo on the frozen build (the old cut used a 16x button that no longer exists), refresh `event/SUBMISSION.md`, 3-4 slides, one rehearsal.
3. **20:00-22:00:** fixes from pitch feedback, final form update, Drive refresh, handover notes.
4. **Not run by Claude:** Playwright e2e cannot run in Claude's container. The Lead runs `npm run test:e2e` before each merge.
5. **After the event:** JPL Horizons recalibration of Sun and Earth geometry, and a physically derived "hardest site".

## Next immediate gate hurdle
PLAR: pitch at Sunday 17:00 on the live build, final submission before the 22:00 cut line.
