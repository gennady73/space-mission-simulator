import { expect, test } from '@playwright/test';

/**
 * Spec v2 §10.1 E2E suite, adapted (DECISIONS D-006/D-007):
 *  - test 1 selects a pad explicitly (no default pad) and uses the corrected PDR numbers;
 *  - test 3 expects the fallback badge text that is actually in engine-constants.json.
 * The element ids below are the UI CONTRACT for the cockpit (docs/BUILD-PLAN.md §6). Tests marked
 * fixme turn on once the cockpit screens exist.
 */
test.describe('Space Mission Simulator E2E Verification', () => {
  test.fixme('PDR gate rejects a battery below the 15% power margin', async ({ page }) => {
    await page.goto('/');
    await page.click('button#btn-site-shackleton_ridge');
    await page.click('button#btn-next-phase'); // MCR pass
    await page.click('button#btn-pad-pad_sintered');
    await page.fill('input#input-pad-distance', '1500');
    await page.click('button#btn-next-phase'); // SRR pass
    await page.click('button#btn-battery-batt_liion_4kwh'); // fails GSFC-STD-1000 Rule 1.06 (15% at PDR)
    await page.click('button#btn-next-phase'); // PDR attempt
    const banner = page.locator('.gate-error-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('GSFC-STD-1000 Rule 1.06');
    await expect(banner).toContainText('ERR_PDR_POWER_MARGIN_VIOLATION');
  });

  test.fixme('Elevated pad with 45° deflectors passes SRR at 800 m', async ({ page }) => {
    await page.goto('/');
    await page.click('button#btn-site-shackleton_ridge');
    await page.click('button#btn-next-phase');
    await page.click('button#btn-pad-pad_elevated_45deg');
    await page.fill('input#input-pad-distance', '800');
    await page.click('button#btn-next-phase');
    await expect(page.locator('#current-phase-display')).toHaveText('Phase B: Preliminary Design Review (PDR)');
  });

  test('Intro placeholder renders its text fallback when the image is missing', async ({ page }) => {
    await page.goto('/');
    const intro = page.locator('[data-placeholder-id="IMG-PLACEHOLDER-INTRO"]');
    await expect(intro).toBeVisible();
    await expect(intro.locator('.fallback-frame .fallback-badge')).toContainText('2032 POLAR OUTPOST PIONEER');
  });

  test('Reference mission runs end to end in the build shell', async ({ page }) => {
    await page.goto('/');
    await page.click('button#btn-run-reference');
    await expect(page.locator('#reference-output')).toContainText('"uptimeHours": 8760');
  });
});
