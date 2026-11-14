# CONTEXT — current mission state

> Core Triad: load this file together with `docs/space-mission-simulator-implementation-specification-final-v2.md`, `docs/BUILD-PLAN.md` (errata to the spec) and `public/config/engine-constants.json`.
> Update this file at every stage transition: what changed, what's green, what's blocking.

**Updated:** 2026-11-15 ~01:45 IST by Lead (Claude, Lead instance)
**Team:** Lead only from 11-15 00:40 (Architect, Hardware and Media offline until morning) — the Lead's Claude covers all roles; decision IDs keep their ranges
**Event clock:** NASA Space Apps, Sat 14 – Sun 15 Nov 2026 · **Cut line: Sun 12:00** · Challenge: *Space Mission Design Game*

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
- Cockpit playable end to end: MCR → SRR → PDR → CDR → flight year → debrief → revise; team hot-seat mode; difficulty; export and share link.
- Tests: 24 unit (vitest) and 9 end-to-end (Playwright) pass on the Lead's machine.
- Side-quests: five optional calculations in SRR, PDR and CDR, answers checked inline (D-101).
- V-01 done: PDR margins now GSFC-STD-1000 Rule 1.06 (15% power, 10% mass); STMD ranks and need IDs verified (D-021, D-022).
- **Live:** https://gennady73.github.io/space-mission-simulator/ (GitHub Pages, redeploys on every merge to `main`, D-103).
- Hypothesis card on every phase (Architect D-031).
- Placeholder fallbacks work with zero media files.
- About & Numbers page built (`src/ui/AboutNumbersView.ts`, open at `#about`): model scope, all 246 numbers with source and tier, credits, AI-use declaration. Provenance coverage is unit-tested (D-027).

## Open / blocking
0. **Now (01:45 → Sun 12:00, solo):** game shell done (D-113); next = NASA data credits in submission/README/About → demo video (30 s, subtitles) → site-number provenance decision (ILLUMINATION-CHECK, needs the Lead's sign-off in Hardware's place) → final Drive refresh and submission.
1. **Hypothesis screen** (Architect): questions are now in `pre_stage_questions` (D-030). Also open: JSON import + compare, failure-hour marker on charts.
2. **NASA data:** organiser answer: no restrictions, only recommendations; credit sources (D-028). LOLA / Diviner / Horizons processing is a Could item; the game ships on the synthetic site model until then.
3. **Repo push:** the Lead's Claude cannot push (GitHub App not installed). It edits the Lead's local clone; the Lead commits and pushes.

4. **Lead:** demo video (shot list in `event/SUBMISSION.md`), paste submission text into the Space Apps form.
5. **Decision IDs:** Architect D-032 onward, Lead D-101 onward (D-102).

## Next immediate gate hurdle
PLAR: the game is live on GitHub Pages and the Space Apps submission is filed before the Sunday 12:00 cut line.
