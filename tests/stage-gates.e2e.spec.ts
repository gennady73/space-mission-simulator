import { expect, test, type Page } from '@playwright/test';

/**
 * Spec v2 §10.1 E2E suite, adapted (DECISIONS D-006/D-007/D-023):
 *  - no default pad; each phase needs its own choices before its review can start;
 *  - the fallback badge text is the one in engine-constants.json.
 * The element ids are the UI contract of the cockpit (docs/BUILD-PLAN.md §6):
 * #btn-<category>-<catalogId>, #btn-next-phase, #current-phase-display, .gate-error-banner.
 */
const pick = async (page: Page, ...ids: string[]) => { for (const id of ids) await page.click(`button#${id}`); };
const next = (page: Page) => page.click('button#btn-next-phase');
const phase = (page: Page) => page.locator('#current-phase-display');

async function passMcrAndSrr(page: Page, pad: string, distance: string): Promise<void> {
  await page.goto('/');
  await pick(page, 'btn-site-shackleton_ridge');
  await next(page);
  await expect(phase(page)).toHaveText('Phase A: System Requirements Review (SRR)');
  await pick(page, 'btn-lv-lv_medium_reusable', pad);
  await page.fill('input#input-pad-distance', distance);
  await next(page);
}

test.describe('Space Mission Simulator E2E Verification', () => {
  test('PDR gate rejects a battery below the 15% power margin', async ({ page }) => {
    await passMcrAndSrr(page, 'btn-pad-pad_sintered', '1500');
    await pick(page, 'btn-mast-mast_10m_vsat', 'btn-battery-batt_liion_4kwh', 'btn-comm-dte_xband', 'btn-storage-ssmm_128gb');
    await next(page);
    const banner = page.locator('.gate-error-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('GSFC-STD-1000 Rule 1.06');
    await expect(banner).toContainText('ERR_PDR_POWER_MARGIN_VIOLATION');
    await expect(phase(page)).toHaveText('Phase B: Preliminary Design Review (PDR)');
  });

  test('Elevated pad with 45° deflectors passes SRR at 800 m', async ({ page }) => {
    await passMcrAndSrr(page, 'btn-pad-pad_elevated_45deg', '800');
    await expect(phase(page)).toHaveText('Phase B: Preliminary Design Review (PDR)');
  });

  test('Natural bowl at 800 m is stopped at SRR for plume scouring', async ({ page }) => {
    await passMcrAndSrr(page, 'btn-pad-pad_natural_bowl', '800');
    await expect(page.locator('.gate-error-banner')).toContainText('ERR_SRR_PLUME_SCOURING_HAZARD');
    await expect(phase(page)).toHaveText('Phase A: System Requirements Review (SRR)');
  });

  test('A review cannot start while a choice of its phase is missing', async ({ page }) => {
    await page.goto('/');
    await next(page);
    await expect(page.locator('.gate-error-banner')).toContainText('ERR_DESIGN_INCOMPLETE');
    await expect(page.locator('.gate-error-banner')).toContainText('landing site');
  });

  test('A full design chosen on screen flies the year and reaches the debrief', async ({ page }) => {
    await passMcrAndSrr(page, 'btn-pad-pad_elevated_45deg', '800');
    await pick(page, 'btn-mast-mast_10m_vsat', 'btn-battery-batt_liion_8kwh', 'btn-comm-dte_xband', 'btn-storage-ssmm_128gb',
      'btn-instrument-ndl', 'btn-instrument-neutron_spec_radiometer');
    await next(page);
    await expect(phase(page)).toHaveText('Phase C: Critical Design Review (CDR)');
    await pick(page, 'btn-logistics-hts_maglev_guideway', 'btn-link-laser_power_beaming');
    await next(page);
    await expect(phase(page)).toHaveText('Phase D/E: Post-Launch Assessment Review (PLAR)');
    await expect(page.locator('.gate-pass-banner')).toContainText('Mission successful');
    await expect(page.locator('.strip-chart')).toHaveCount(4);
    // Same design as the reference button, so it must reach the same result.
    await expect(page.locator('#reference-output')).toContainText('"uptimeHours": 8760');
  });

  test('A drill heater below the limit is stopped at CDR', async ({ page }) => {
    await passMcrAndSrr(page, 'btn-pad-pad_elevated_45deg', '800');
    await pick(page, 'btn-mast-mast_10m_vsat', 'btn-battery-batt_liion_8kwh', 'btn-comm-dte_xband', 'btn-storage-ssmm_128gb');
    await next(page);
    await pick(page, 'btn-logistics-hts_maglev_guideway', 'btn-link-laser_power_beaming');
    await page.fill('input#input-drill-heater', '20');
    await next(page);
    await expect(page.locator('.gate-error-banner')).toContainText('ERR_CDR_THERMAL_FREEZE_HAZARD');
  });

  test('Team play: a seat makes only its own decisions and the gate owner signs off', async ({ page }) => {
    await page.goto('/');
    await page.check('#toggle-team-mode');
    await expect(page.locator('#btn-role-mission_lead')).toHaveAttribute('aria-pressed', 'true');
    await pick(page, 'btn-site-shackleton_ridge');
    await next(page); // Mission Lead owns MCR
    await expect(phase(page)).toHaveText('Phase A: System Requirements Review (SRR)');
    // Still the Mission Lead: launch decisions and the SRR sign-off belong to Launch & Structures.
    await expect(page.locator('#btn-lv-lv_medium_reusable')).toBeDisabled();
    await expect(page.locator('#btn-next-phase')).toBeDisabled();
    await expect(page.locator('#signoff-note')).toContainText('Launch & Structures');
    await pick(page, 'btn-role-launch_structures', 'btn-lv-lv_medium_reusable', 'btn-pad-pad_elevated_45deg');
    await page.fill('input#input-pad-distance', '800');
    await next(page);
    await expect(phase(page)).toHaveText('Phase B: Preliminary Design Review (PDR)');
    // Power & Thermal owns the battery, Comms & Science owns the instruments.
    await expect(page.locator('#btn-battery-batt_liion_8kwh')).toBeDisabled();
    await pick(page, 'btn-role-comms_science');
    await expect(page.locator('#btn-instrument-ndl')).toBeEnabled();
    await expect(page.locator('#btn-battery-batt_liion_8kwh')).toBeDisabled();
  });

  test('Intro placeholder renders its text fallback when the image is missing', async ({ page }) => {
    await page.goto('/');
    const intro = page.locator('[data-placeholder-id="IMG-PLACEHOLDER-INTRO"]');
    await expect(intro).toBeVisible();
    await expect(intro.locator('.fallback-frame .fallback-badge')).toContainText('2032 POLAR OUTPOST PIONEER');
  });

  test('Pre-stage question reveals its explanation only after a hypothesis (spec §8.1)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#pre-stage-question')).toContainText('permanently shadowed craters');
    await expect(page.locator('#pre-stage-explanation')).toHaveCount(0);
    await expect(page.locator('#btn-reveal-explanation')).toBeDisabled();
    await page.fill('#input-hypothesis', 'The Sun stays near the horizon, so ridges stay lit and crater floors stay dark.');
    await page.click('#btn-reveal-explanation');
    await expect(page.locator('#pre-stage-explanation')).toContainText('tilted only about 1.5 degrees');
    // The next phase asks its own question again, unanswered.
    await pick(page, 'btn-site-shackleton_ridge');
    await next(page);
    await expect(phase(page)).toHaveText('Phase A: System Requirements Review (SRR)');
    await expect(page.locator('#pre-stage-question')).toContainText('sandblast');
    await expect(page.locator('#pre-stage-explanation')).toHaveCount(0);
    // Going back to MCR, the recorded hypothesis and the answer are still there.
    await page.click('button#btn-phase-MCR');
    await expect(page.locator('#input-hypothesis')).toHaveValue(/ridges stay lit/);
    await expect(page.locator('#pre-stage-explanation')).toBeVisible();
  });

  test('Reference mission runs end to end', async ({ page }) => {
    await page.goto('/');
    await page.click('button#btn-run-reference');
    await expect(page.locator('#reference-output')).toContainText('"uptimeHours": 8760');
    await page.click('button#btn-revise-design');
    await expect(phase(page)).toHaveText('Pre-Phase A: Mission Concept Review (MCR)');
  });
});
