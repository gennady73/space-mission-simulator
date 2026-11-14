# Polar Outpost Pioneer — Space Mission Design Game

**NASA Space Apps Challenge 2026 · Challenge: _Space Mission Design Game_ · Team eleven-two**

Design a robotic outpost at the Moon's south pole the way NASA designs missions:

- Pick a site, a launcher, a landing pad, a power mast, batteries, communications and science instruments.
- Get each design past a NASA-style review gate (MCR, SRR, PDR, CDR).
- Then fly it: a deterministic 365-day, hour-by-hour simulation of sunlight, shadows, battery charge, Earth visibility, data and water-ice extraction.
- When the mission fails, the debrief explains why, and which choice to change.

Play solo, or as a team of up to four. Each player owns one NASA mission segment (Launch, Space, Ground, User) and signs off their gates.

> Status: in development during the event (14–15 Nov 2026). See `docs/BUILD-PLAN.md`.

## Run it
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests
npm run build      # static site in dist/ (deployed to GitHub Pages)
```

## How it works
- Every number lives in [`public/config/engine-constants.json`](public/config/engine-constants.json), with its source and a tier (NASA document, literature, physical constant, provisional, or game rule). The in-game *About & Numbers* page shows them all.
- The engine (`src/engine/`) is pure TypeScript. It needs no server and runs offline.

## NASA data and documents
- NASA Space Apps resources: *Design and Develop Science Missions* (four mission segments), CubeSat 101, Concept Maturity Levels, Mission Design Lab.
- NASA STMD *FY26 Civil Space Shortfall Prioritization*; NASA TechPort project 116305 (Vertical Solar Array Technology).
- NASA Systems Engineering Handbook (SP-2016-6105 Rev 2), NPR 7120.5, GSFC-STD-1000.
- Planned, pending organiser confirmation: LOLA 5 m/px south-pole sites (PGDA product 78; Barker et al. 2021), the LOLA 120 m polar grid (PDS), the LRO Diviner South Polar Resource Product (PDS; D. A. Paige), and JPL Horizons ephemerides.

## Use of AI
This project was designed and built with AI assistance:
- The game specification was drafted with Google Gemini (NotebookLM) from the NASA materials listed above.
- Code, constants and documentation were written with Anthropic Claude, under the team's direction and review.

All NASA data and documents are credited above. AI-generated numbers are marked by tier in the constants file.

## Team
eleven-two
