import { expect, test } from '@playwright/test';

/** Side-quest dialog (REQ-008, D-101). Ids: #btn-quest-<id>, #input-quest-answer, #btn-quest-check. */
test.describe('Side-quests', () => {
  test('SRR offers the plume quest; a wrong then a right answer, solved mark stays', async ({ page }) => {
    await page.goto('/');
    await page.click('button#btn-site-shackleton_ridge');
    await page.click('button#btn-next-phase');
    await expect(page.locator('#current-phase-display')).toHaveText('Phase A: System Requirements Review (SRR)');

    await page.click('button#btn-quest-quest_plume_deflector');
    const dialog = page.locator('dialog.quest');
    await expect(dialog).toBeVisible();

    await page.fill('input#input-quest-answer', '1200');
    await page.click('button#btn-quest-check');
    await expect(dialog.locator('.quest-feedback--wrong')).toContainText('too high');

    await page.fill('input#input-quest-answer', '600 m');
    await page.click('button#btn-quest-check');
    await expect(dialog.locator('.quest-feedback--correct')).toBeVisible();
    await expect(dialog.locator('.quest-explanation')).toContainText('600 m');

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('button#btn-quest-quest_plume_deflector')).toHaveClass(/quest-btn--done/);
  });
});
