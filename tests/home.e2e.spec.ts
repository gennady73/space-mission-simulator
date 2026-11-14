import { expect, test } from '@playwright/test';

/**
 * Landing page (D-301): first-time visitors see it at '/', and START MISSION opens the cockpit
 * at MCR without leaving the page. The game name is deliberately not asserted: it is a
 * placeholder in public/config/ui-config.json until the team decides it.
 */
test('landing page at / and START MISSION opens the console at MCR', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  await expect(page.locator('.home')).toBeVisible();
  await expect(page.locator('#current-phase-display')).toHaveCount(0);

  const cta = page.locator('#btn-start-mission');
  await expect(cta).toBeVisible();
  const box = (await cta.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(768); // the button is on screen without scrolling

  await cta.click();
  await expect(page.locator('#current-phase-display')).toHaveText('Pre-Phase A: Mission Concept Review (MCR)');
  await expect(page.locator('#console-viewport .sitemap')).toBeVisible();
  expect(page.url()).toContain('#mission');
});

test('About & numbers opens in the same tab and Back returns to the landing page', async ({ page }) => {
  await page.goto('/');
  await page.click('.home__links a[href="#about"]');
  await expect(page.locator('#about-numbers')).toBeVisible();
  await expect(page.locator('.home')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('.home')).toBeVisible();
  await expect(page.locator('#about-numbers')).toHaveCount(0);
});
