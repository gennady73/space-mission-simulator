import { expect, test, type Page } from '@playwright/test';

/**
 * Landing page (D-301, D-305): first-time visitors see it at '/'. START MISSION opens the
 * "How to play" slides in place of the title block; "Begin mission" on the last slide, or "Skip",
 * opens the cockpit at MCR without leaving the page. The page is one screen: nothing scrolls at
 * laptop sizes. The game name is deliberately not asserted: it lives in public/config/ui-config.json.
 */

const MCR_TITLE = 'Pre-Phase A: Mission Concept Review (MCR)';
const LAPTOPS = [{ width: 1280, height: 720 }, { width: 1440, height: 900 }, { width: 1024, height: 768 }];

/** Pixels the page or the hero's middle would have to scroll; 0 means everything is on screen. */
async function overflowPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const stage = document.querySelector('.home__stage');
    return Math.max(doc.scrollHeight - doc.clientHeight, stage ? stage.scrollHeight - stage.clientHeight : 0);
  });
}

async function expectConsoleAtMCR(page: Page): Promise<void> {
  await expect(page.locator('#current-phase-display')).toHaveText(MCR_TITLE);
  await expect(page.locator('#console-viewport .sitemap')).toBeVisible();
  await expect(page.locator('.home')).toHaveCount(0);
  expect(page.url()).toContain('#mission');
}

test('START MISSION opens How to play; the last slide\'s Begin mission opens the console at MCR', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  await expect(page.locator('.home')).toBeVisible();
  await expect(page.locator('#current-phase-display')).toHaveCount(0);

  const cta = page.locator('#btn-start-mission');
  await expect(cta).toBeVisible();
  const box = (await cta.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(768); // the button is on screen without scrolling

  await cta.click();
  // The slides replace the title block; the console has not started; focus is on the heading.
  const panel = page.locator('#how-to-play');
  await expect(panel).toBeVisible();
  await expect(page.locator('#how-to-play-title')).toBeFocused();
  await expect(page.locator('#btn-start-mission')).toHaveCount(0);
  await expect(page.locator('#current-phase-display')).toHaveCount(0);
  await expect(page.locator('.home__nav')).toBeVisible();

  const total = await page.locator('.home__dot').count();
  expect(total).toBeGreaterThan(1);
  await expect(page.locator('.home__step-count')).toHaveText(`1 / ${total}`);
  await expect(page.locator('.home__step-tag')).toHaveText('MCR');
  await expect(page.locator('#btn-step-back')).toBeDisabled();
  await expect(page.locator('.home__dot').first()).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.home__dot').first()).toHaveAttribute('aria-label', `Step 1 of ${total}`);
  await expect(page.locator('#btn-skip-tutorial')).toBeVisible();

  // Step through to the last slide: Next is the only primary button until then.
  for (let i = 1; i < total; i++) {
    await expect(page.locator('.home .cta:visible')).toHaveCount(1);
    await expect(page.locator('#btn-begin-mission')).toBeHidden();
    await page.click('#btn-step-next');
    await expect(page.locator('.home__step-count')).toHaveText(`${i + 1} / ${total}`);
  }
  await expect(page.locator('.home__dot').last()).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.home__tips li')).not.toHaveCount(0);
  await expect(page.locator('#btn-step-next')).toBeHidden();
  const begin = page.locator('#btn-begin-mission');
  await expect(begin).toBeVisible();
  await expect(page.locator('.home .cta:visible')).toHaveCount(1);

  await begin.click();
  await expectConsoleAtMCR(page);
});

test('Skip on the slides goes straight to the console', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-start-mission');
  await expect(page.locator('#how-to-play')).toBeVisible();
  await page.click('#btn-skip-tutorial');
  await expectConsoleAtMCR(page);
});

test('arrow keys change the slide, Escape and Back to home return to the title block', async ({ page }) => {
  await page.goto('/');
  await page.focus('#btn-start-mission');
  await page.keyboard.press('Enter');
  const count = page.locator('.home__step-count');
  const total = await page.locator('.home__dot').count();
  await expect(count).toHaveText(`1 / ${total}`);
  await page.keyboard.press('ArrowRight');
  await expect(count).toHaveText(`2 / ${total}`);
  await expect(page.locator('.home__step-tag')).toHaveText('SRR');
  await page.keyboard.press('ArrowRight');
  await expect(count).toHaveText(`3 / ${total}`);
  await page.keyboard.press('ArrowLeft');
  await expect(count).toHaveText(`2 / ${total}`);

  await page.keyboard.press('Escape');
  await expect(page.locator('#how-to-play')).toHaveCount(0);
  await expect(page.locator('#btn-start-mission')).toBeFocused();

  // The nav link opens the same panel at the first slide; Back to home closes it.
  await page.click('.home__links a[href="#how-to-play"]');
  await expect(page.locator('#how-to-play-title')).toBeFocused();
  await expect(count).toHaveText(`1 / ${total}`);
  await page.click('#btn-howto-home');
  await expect(page.locator('#how-to-play')).toHaveCount(0);
  await expect(page.locator('#btn-start-mission')).toBeVisible();
  await expect(page.locator('#current-phase-display')).toHaveCount(0);
});

test('How it works shows the three cards in place of the title block', async ({ page }) => {
  await page.goto('/');
  await page.click('.home__links a[href="#how-it-works"]');
  await expect(page.locator('#how-it-works')).toBeVisible();
  await expect(page.locator('#how-it-works-title')).toBeFocused();
  await expect(page.locator('#how-it-works .home__card')).toHaveCount(3);
  await expect(page.locator('#btn-start-mission')).toHaveCount(0);
  await expect(page.locator('.home__narrator')).toBeVisible();
  await page.click('#btn-works-home');
  await expect(page.locator('#how-it-works')).toHaveCount(0);
  await expect(page.locator('#btn-start-mission')).toBeVisible();
  // Focus goes back to the control that opened the panel.
  await expect(page.locator('.home__links a[href="#how-it-works"]')).toBeFocused();
});

test('direct links still skip the instructions: #mission opens the console', async ({ page }) => {
  await page.goto('/#mission');
  await expect(page.locator('#how-to-play')).toHaveCount(0);
  await expect(page.locator('.home')).toHaveCount(0);
  await expect(page.locator('#current-phase-display')).toHaveText(MCR_TITLE);
});

for (const size of LAPTOPS) {
  test(`nothing scrolls at ${size.width}x${size.height}: title block, every slide, the cards`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.locator('#btn-start-mission')).toBeVisible();
    expect(await overflowPx(page), 'title block').toBe(0);

    await page.click('#btn-start-mission');
    const total = await page.locator('.home__dot').count();
    for (let i = 0; i < total; i++) {
      await expect(page.locator('.home__step-count')).toHaveText(`${i + 1} / ${total}`);
      expect(await overflowPx(page), `slide ${i + 1}`).toBe(0);
      const primary = (await page.locator('.home .cta:visible').boundingBox())!;
      expect(primary.y + primary.height, `slide ${i + 1} primary button on screen`).toBeLessThanOrEqual(size.height);
      if (i < total - 1) await page.click('#btn-step-next');
    }

    await page.click('.home__links a[href="#how-it-works"]');
    await expect(page.locator('#how-it-works .home__card')).toHaveCount(3);
    expect(await overflowPx(page), 'cards').toBe(0);
  });
}

test('About & numbers opens in the same tab and Back returns to the landing page', async ({ page }) => {
  await page.goto('/');
  await page.click('.home__links a[href="#about"]');
  await expect(page.locator('#about-numbers')).toBeVisible();
  await expect(page.locator('.home')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('.home')).toBeVisible();
  await expect(page.locator('#about-numbers')).toHaveCount(0);
});
