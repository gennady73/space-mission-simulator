import './about.css';
import type { EngineConstants } from '../models/Interfaces';
import { buildProvenanceGroups, collectNumbers, formatValue, TIER_LABELS, TIER_ORDER, tierCounts } from './aboutModel';

/**
 * "About & Numbers" page (BUILD-PLAN §3 Must; design guide §4 validity rules).
 * Shows what the model includes and leaves out, every number with its source and tier,
 * data credits and the AI-use declaration.
 *
 * Mount it anywhere: `container.append(renderAboutNumbers(constants))`.
 * The cockpit routes to it at #about (Architect wires the route).
 */

const ORGANISER_DATA_NOTE = 'https://github.com/nasa/spaceapps/discussions/2088#discussioncomment-19607192';

interface Credit { title: string; href: string; detail: string; status: 'used' | 'planned' }

const DOCUMENT_CREDITS: Credit[] = [
  { title: 'Design and Develop Science Missions (NASA)', href: 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf', detail: 'Four mission segments (Launch, Space, Ground, User) and the order of work. The structure of the whole game.', status: 'used' },
  { title: 'GSFC-STD-1000 Rev I, Rule 1.06 Resource Margins (NASA Goddard)', href: 'https://standards.nasa.gov/standard/GSFC/GSFC-STD-1000', detail: 'Power and dry-mass margins required at PDR.', status: 'used' },
  { title: 'FY26 Civil Space Shortfall Prioritization (NASA STMD)', href: 'https://www.nasa.gov/wp-content/uploads/2026/05/fy26-civil-space-shortfall-prioritization.pdf', detail: 'Shortfall IDs, ranks and need statements behind gate messages and badges.', status: 'used' },
  { title: 'Vertical Solar Array Technology (NASA TechPort project 116305)', href: 'https://www.nasa.gov/technology/nasa-industry-to-mature-vertical-solar-array-technologies-for-lunar-surface/', detail: 'The idea of tall vertical solar masts for polar sunlight.', status: 'used' },
  { title: 'NASA Systems Engineering Handbook (SP-2016-6105 Rev 2) and NPR 7120.5', href: 'https://www.nasa.gov/reference/systems-engineering-handbook/', detail: 'Life-cycle phases and review gates (MCR, SRR, PDR, CDR, PLAR).', status: 'used' },
  { title: 'Basics of Space Flight (NASA JPL)', href: 'https://science.nasa.gov/learn/basics-of-space-flight/', detail: 'Fault protection and safing (ch. 11) behind the optional fault-protection choice; light time (ch. 1) behind the signal-delay question.', status: 'used' },
  { title: 'CubeSat 101 (NASA CSLI)', href: 'https://www.nasa.gov/wp-content/uploads/2017/03/nasa_csli_cubesat_101_508.pdf', detail: 'Plain-language mission concepts and subsystem lists.', status: 'used' },
];

const DATA_CREDITS: Credit[] = [
  { title: 'LOLA 120 m polar grid (LDEM_75S_120M) — NASA PDS, LRO-L-LOLA-4-GDR-V1.0', href: 'https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/', detail: 'The regional terrain the map renders, and 120 m close-ups of every landing site (processed by tools/data-pipeline/lola_crop.py into public/data/terrain/).', status: 'used' },
  { title: 'LOLA 5 m/px south-pole site maps — NASA PGDA product 78 (Barker et al. 2021)', href: 'https://pgda.gsfc.nasa.gov/products/78', detail: 'Sharp terrain within 4 km of the Shackleton connecting ridge, de Gerlache rim and Malapert massif sites.', status: 'used' },
  { title: 'LRO Diviner South Polar Resource Product v2 — NASA PDS (D. A. Paige, UCLA)', href: 'https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/', detail: 'Annual maximum temperature and depth to stable water ice: the cold traps the map paints. The 110 K surface-ice limit follows Paige et al. 2010, Science 330.', status: 'used' },
  { title: 'Lunar Polar Illumination — NASA PGDA product 69 (Mazarico et al. 2011)', href: 'https://pgda.gsfc.nasa.gov/products/69', detail: 'Permanent-shadow maps (60 m) drawn in the site close-ups; average sunlight and Earth visibility used to cross-check the site catalog.', status: 'used' },
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: Array<Node | string>): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const link = (href: string, text: string) => el('a', { href, target: '_blank', rel: 'noopener' }, text);
const tierBadge = (tier: keyof typeof TIER_LABELS) => el('span', { className: `tier tier--${tier}`, title: TIER_LABELS[tier].meaning }, TIER_LABELS[tier].label);

export function renderAboutNumbers(c: EngineConstants): HTMLElement {
  const s = c.simulation;
  const page = el('section', { className: 'about', id: 'about-numbers' });

  page.append(
    el('h1', {}, 'About & Numbers'),
    el('p', { className: 'about__lead' },
      'Lighthouse on the Trail is a teaching model, not a flight tool. This page shows what the model includes, what it leaves out, and where every number in the game comes from, so you can check any result yourself.'),
  );

  // --- What the model includes / leaves out, and its scales (rules 2, 3) ---
  const fmt = (path: string, v: number) => formatValue(c, path, v);
  page.append(
    el('h2', {}, 'What the model does'),
    el('ul', {},
      el('li', {}, `Runs your outpost for ${fmt('simulation.mission_duration_h', s.mission_duration_h)} in steps of ${fmt('simulation.time_step_h', s.time_step_h)}. Every chart value is an hourly value.`),
      el('li', {}, 'Each hour it updates the four NASA mission segments together: sunlight and power (Space), Earth visibility and data (Ground), ice assayed (User), after the launch checks (Launch).'),
      el('li', {}, 'Checks your design at four review gates (MCR, SRR, PDR, CDR) and a final review (PLAR). Every failure names the check, the cause and what to change.'),
      el('li', {}, 'The south-pole map draws real NASA terrain (LOLA, 120 m and 5 m per pixel) with Diviner cold traps and LOLA permanent shadow; where the processed data ends it falls back to schematic terrain and says so in its corner.'),
      el('li', {}, `Random events (dust, cable snags, rover wear) come from a seeded generator: the same design and seed always give the same mission (seed ${s.default_seed}).`),
    ),
    el('h2', {}, 'What the model leaves out'),
    el('ul', {},
      el('li', {}, `Sun and Earth positions are a smooth yearly pattern tuned to each site (Sun ±${fmt('simulation.solar_elevation_amplitude_deg', s.solar_elevation_amplitude_deg)}, Earth ±${fmt('simulation.earth_libration_amplitude_deg', s.earth_libration_amplitude_deg)}), not real ephemerides yet. Site values are marked Provisional below.`),
      el('li', {}, 'No orbit is integrated: transfers are compared by their landing Δv, cruise time and cost.'),
      el('li', {}, 'Temperatures are not simulated hour by hour; cold-trap survival is a heater-power threshold.'),
      el('li', {}, 'Costs, launcher capacities and budgets are rounded team estimates (Game rule), chosen to make the trade-offs real, not to price a mission.'),
    ),
  );

  // --- Tier legend with counts (rule 9) ---
  const counts = tierCounts(c);
  const total = collectNumbers(c).length;
  const legend = el('ul', { className: 'about__tiers' });
  for (const t of TIER_ORDER) legend.append(el('li', {}, tierBadge(t), ` ${counts[t]} — ${TIER_LABELS[t].meaning}`));
  page.append(el('h2', {}, `Every number (${total})`), el('p', {}, 'Each number carries a tier, so a rule we invented is never mistaken for a NASA value.'), legend);

  // --- Numbers, grouped by source (rule 1) ---
  const list = el('div', { className: 'about__numbers' });
  for (const g of buildProvenanceGroups(c)) {
    const head = el('summary', {}, tierBadge(g.provenance.tier), ' ', el('code', {}, g.key), ` — ${g.rows.length} number${g.rows.length === 1 ? '' : 's'}`);
    const src = el('p', { className: 'about__source' }, el('strong', {}, 'Source: '), g.provenance.source);
    if (g.provenance.note) src.append(el('br'), el('em', {}, g.provenance.note));
    const table = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Quantity'), el('th', {}, 'Value'))));
    const body = el('tbody');
    for (const r of g.rows) body.append(el('tr', {}, el('td', { title: r.path }, r.label), el('td', { className: 'num' }, r.display)));
    table.append(body);
    list.append(el('details', {}, head, src, table));
  }
  page.append(list);

  // --- Credits ---
  const creditList = (items: Credit[]) => {
    const ul = el('ul', { className: 'about__credits' });
    for (const it of items) ul.append(el('li', {}, link(it.href, it.title), ` — ${it.detail}`, it.status === 'planned' ? el('span', { className: 'about__planned' }, ' Planned, not yet in this build.') : ''));
    return ul;
  };
  page.append(
    el('h2', {}, 'NASA documents used'), creditList(DOCUMENT_CREDITS),
    el('h2', {}, 'NASA data sets'), creditList(DATA_CREDITS),
    el('p', {}, 'Using public data beyond the challenge\'s Resources tab, with credit, is allowed by the event (', link(ORGANISER_DATA_NOTE, 'organiser answer'), ').'),
  );

  // --- AI use (rule 10) ---
  page.append(
    el('h2', {}, 'Use of AI'),
    el('p', {}, 'The game specification was drafted with Google Gemini (NotebookLM) from the NASA materials above. Code, the constants file and documentation were written with Anthropic Claude under the team\'s direction and review. Every AI-produced number is tiered on this page; the NASA citations were checked against the source documents by hand.'),
  );

  // --- Download (REQ-007, read-only part) ---
  const dl = el('button', { type: 'button', id: 'btn-download-constants' }, 'Download all numbers (JSON)');
  dl.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'engine-constants.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  page.append(el('p', {}, dl));

  page.append(el('p', { className: 'about__team' }, 'Team eleven-two · NASA Space Apps Challenge 2026 · Space Mission Design Game'));
  return page;
}
