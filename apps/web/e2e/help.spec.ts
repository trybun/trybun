import { expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { navigateInApp } from './client-navigation.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { HelpPage } from './pages/help.page.js';
import { expectTouchTarget, minimumTargetSize } from './touch-targets.js';

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

    // The team also reads the pages for Administrators, which name the authenticator app too.
    await expect(help.results.filter({ hasText: 'Getting started for the team' })).toHaveCount(1);

    const menu = await new AppShellPage(page).openAccountMenu();
    await menu.getByRole('menuitemradio', { name: 'Polski' }).click();
    await expect(help.heading).toHaveText('Pomoc');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    await help.search.fill('uwierzytelniajacej');

    const result = help.results.filter({ hasText: 'Pierwsze kroki dla zespołu' });
    await expect(result).toHaveCount(1);
    await result.click();
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

  test('shows the not-found page of the help for a topic that does not exist', async ({ page }) => {
    const response = await page.goto('/help/no-such-topic');

    expect(response?.status()).toBe(404);
    // Inside the shell of the reader, with the way back to all help topics (#401).
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page).toHaveTitle('Page not found – Trybun');
    await expect(page.getByRole('link', { name: 'All help topics' })).toHaveAttribute(
      'href',
      '/help',
    );
    await expect(new AppShellPage(page).navigation).toBeVisible();
  });

  // The tab names the topic, then the help, after a client-side navigation and a page load (#407).
  test('names the help and a topic in the tab', async ({ page }) => {
    const help = new HelpPage(page);
    await help.goto();
    await expect(page).toHaveTitle('Help – Trybun');

    await navigateInApp(page, '/help/team/tutorials/getting-started');
    await expect(help.heading).toHaveText('Getting started for the team');
    await expect(page).toHaveTitle('Getting started for the team – Help – Trybun');

    await page.reload();
    await expect(page).toHaveTitle('Getting started for the team – Help – Trybun');

    const menu = await new AppShellPage(page).openAccountMenu();
    await menu.getByRole('menuitemradio', { name: 'Polski' }).click();
    await expect(page).toHaveTitle('Pierwsze kroki dla zespołu – Pomoc – Trybun');
  });

  // The not-found metadata comes from `generateMetadata` of the page, so the tab title is
  // translated after a client-side navigation too (#404).
  test('translates the tab title of a missing topic after a client-side navigation', async ({
    page,
  }) => {
    const help = new HelpPage(page);
    await help.goto();
    await expect(help.heading).toHaveText('Help');

    await navigateInApp(page, '/help/no-such-topic');

    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page).toHaveTitle('Page not found – Trybun');
  });

  test('has touch targets of at least 44 px', async ({ page }) => {
    const shell = new AppShellPage(page);
    const help = new HelpPage(page);
    await help.goto();
    const minimum = minimumTargetSize(test.info());

    for (const target of [shell.help, help.search, help.results.first()]) {
      await expectTouchTarget(target, minimum);
    }
  });
});
