import { expect, test, type Page } from '@playwright/test';

/**
 * Spec v2 §10.1 E2E suite, adapted (DECISIONS D-006/D-007/D-023):
 *  - no default pad; each phase needs its own choices before its review can start;
 *  - the fallback badge text is the one in engine-constants.json.
 * The element ids are the UI contract of the cockpit (docs/BUILD-PLAN.md §6):
 * #btn-<category>-<catalogId>, #btn-next-phase, #current-phase-display, .gate-error-banner.
 */
const pick = async (page: Page, ...ids: string[]) => { for (const id of ids) await page.click(`button#${id}`); };
/** Every fresh load greets the player with the start screen (D-113); begin a normal mission. */
const start = async (page: Page) => { await page.goto('/'); await page.click('#btn-start-mission'); };
/** The launch now replays the year in the flight playback (D-105); skip it to reach the debrief. */
const skipFlight = async (page: Page) => {
  await expect(page.locator('#flight-playback')).toBeVisible();
  await page.click('#btn-flight-skip');
  await page.click('#btn-flight-debrief');
};
/** Submit to the review; when the verdict is a pass, take "Next stage" (or "Launch"). A failed verdict stays open. */
const next = async (page: Page) => {
  await page.click('button#btn-next-phase');
  await expect(page.locator('#review-modal')).toBeVisible();
  const go = page.locator('#btn-review-next');
  if (await go.count()) await go.click();
};
const phase = (page: Page) => page.locator('#current-phase-display');

async function passMcrAndSrr(page: Page, pad: string, distance: string): Promise<void> {
  await start(page);
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
    await start(page);
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
    await skipFlight(page);
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
    await start(page);
    await page.click('#btn-menu');
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
    await start(page);
    const intro = page.locator('[data-placeholder-id="IMG-PLACEHOLDER-INTRO"]');
    await expect(intro).toBeVisible();
    await expect(intro.locator('.fallback-frame .fallback-badge')).toContainText('2032 POLAR OUTPOST PIONEER');
  });

  test('Pre-stage question reveals its explanation only after a hypothesis (spec §8.1)', async ({ page }) => {
    await start(page);
    await expect(page.locator('#pre-stage-question')).toContainText('permanently shadowed craters');
    await expect(page.locator('#pre-stage-explanation')).toHaveCount(0);
    await expect(page.locator('#btn-reveal-explanation')).toBeDisabled();
    await page.click('.prestage summary'); // the card is folded to one line by default (D-113)
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
    await start(page);
    await page.click('button#btn-run-reference');
    await skipFlight(page);
    await expect(page.locator('#reference-output')).toContainText('"uptimeHours": 8760');
    await expect(page.locator('#debrief-overlay #debrief-score')).toContainText('of 1000');
    // Revise returns to the last design stage with the design intact (D-036).
    await page.click('button#btn-revise-design');
    await expect(page.locator('#debrief-overlay')).toHaveCount(0);
    await expect(phase(page)).toHaveText('Phase C: Critical Design Review (CDR)');
    await expect(page.locator('#btn-logistics-hts_maglev_guideway')).toHaveAttribute('aria-pressed', 'true');
  });

  test('The console viewport holds the live map through the design phases (D-104)', async ({ page }) => {
    await start(page);
    await expect(page.locator('#console-viewport .sitemap')).toBeVisible();
    await pick(page, 'btn-site-shackleton_ridge');
    await next(page);
    await expect(phase(page)).toHaveText('Phase A: System Requirements Review (SRR)');
    await expect(page.locator('#console-viewport .sitemap')).toBeVisible();
  });

  test('Objectives checklist ticks off what the review needs (D-034)', async ({ page }) => {
    await start(page);
    await expect(page.locator('#objectives-status')).toHaveText('1 still to choose before the review.');
    await pick(page, 'btn-site-shackleton_ridge');
    await expect(page.locator('#objective-selectedSite')).toHaveAttribute('data-done', 'true');
    await expect(page.locator('#objectives-status')).toHaveText('Ready for the review.');
    await next(page);
    await expect(page.locator('#objectives li')).toHaveCount(3);
    await expect(page.locator('#objective-padDistanceM')).toHaveAttribute('data-done', 'false');
    await page.fill('input#input-pad-distance', '800');
    await expect(page.locator('#objective-padDistanceM')).toHaveAttribute('data-done', 'true');
  });

  test('Review modal: a failed verdict gives the reason and the fix, a passed one moves on (D-035)', async ({ page }) => {
    await start(page);
    await page.click('#btn-next-phase');
    const modal = page.locator('#review-modal');
    await expect(modal.locator('#review-verdict')).toHaveText('Verdict: not passed');
    await expect(modal).toContainText('What to change');
    await expect(page.locator('#btn-review-next')).toHaveCount(0);
    await page.click('#btn-review-revise');
    await expect(modal).toHaveCount(0);
    // The verdict stays on the panel while the player fixes the design.
    await expect(page.locator('.console-panel .gate-error-banner')).toBeVisible();
    await pick(page, 'btn-site-shackleton_ridge');
    await page.click('#btn-next-phase');
    await expect(modal.locator('#review-verdict')).toHaveText('Verdict: passed');
    await expect(phase(page)).toHaveText('Pre-Phase A: Mission Concept Review (MCR)');
    await page.click('#btn-review-next');
    await expect(phase(page)).toHaveText('Phase A: System Requirements Review (SRR)');
  });

  test('Full mission at 1024x768 never scrolls the page (D-033)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const noPageScroll = async () =>
      expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight)).toBe(true);
    await passMcrAndSrr(page, 'btn-pad-pad_elevated_45deg', '800');
    await noPageScroll();
    await pick(page, 'btn-mast-mast_10m_vsat', 'btn-battery-batt_liion_8kwh', 'btn-comm-dte_xband', 'btn-storage-ssmm_128gb',
      'btn-instrument-ndl', 'btn-instrument-neutron_spec_radiometer');
    await noPageScroll();
    await next(page);
    await expect(phase(page)).toHaveText('Phase C: Critical Design Review (CDR)');
    await pick(page, 'btn-logistics-hts_maglev_guideway', 'btn-link-laser_power_beaming');
    await noPageScroll();
    await next(page);
    await expect(page.locator('#flight-playback')).toBeVisible();
    await noPageScroll();
    await skipFlight(page);
    await expect(page.locator('.gate-pass-banner')).toContainText('Mission successful');
    await noPageScroll();
  });
});
