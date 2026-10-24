import { expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { HelpPage } from './pages/help.page.js';

test.describe('help', () => {
  test('the help menu opens the help page of the current view', async ({ page }) => {
    const shell = new AppShellPage(page);
    await shell.goto();

    const menu = await shell.openHelpMenu();
    await menu.getByRole('menuitem', { name: 'Help for this view' }).click();

    await expect(page).toHaveURL('/help/team/tutorials/getting-started');
    await expect(shell.heading).toHaveText('Getting started for the team');
  });

  test('finds a page by a word in its body in both languages', async ({ page }) => {
    const help = new HelpPage(page);
    await help.goto();
    await expect(help.heading).toHaveText('Help');

    await help.search.fill('authenticator');

    await expect(help.results).toHaveCount(1);
    await expect(help.results).toContainText('Getting started for the team');

    const menu = await new AppShellPage(page).openAccountMenu();
    await menu.getByRole('menuitemradio', { name: 'Polski' }).click();
    await expect(help.heading).toHaveText('Pomoc');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    await help.search.fill('uwierzytelniajacej');

    await expect(help.results).toHaveCount(1);
    await expect(help.results).toContainText('Pierwsze kroki dla zespołu');
    await help.results.click();
    await expect(page).toHaveURL('/help/team/tutorials/getting-started');
  });

  test('fits the viewport without horizontal scroll', async ({ page }) => {
    const shell = new AppShellPage(page);
    for (const path of ['/help', '/help/team/tutorials/getting-started']) {
      await page.goto(path);
      await expect(shell.heading).toBeVisible();

      expect(await shell.horizontalOverflow()).toBe(0);
    }
  });

  test('has no serious accessibility violations', async ({ page }) => {
    const help = new HelpPage(page);
    await help.goto();
    await expect(help.heading).toHaveText('Help');

    expect(await seriousViolations(page)).toEqual([]);

    await page.goto('/help/team/tutorials/getting-started');
    await expect(help.heading).toHaveText('Getting started for the team');

    expect(await seriousViolations(page)).toEqual([]);
  });

  test('has touch targets of at least 44 px', async ({ page }) => {
    const shell = new AppShellPage(page);
    const help = new HelpPage(page);
    await help.goto();
    // The compact sizes of a precise pointer apply only on desktop (§18.6).
    const minimum = test.info().project.name === 'desktop' ? 32 : 44;

    for (const target of [shell.help, help.search, help.results.first()]) {
      const box = await target.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(minimum);
    }
  });
});
