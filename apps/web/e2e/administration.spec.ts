import { expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AdministrationPage } from './pages/administration.page.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { ADMIN_STORAGE_STATE } from './storage-state.js';

test.describe('Administrator panel', () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test('shows the getting-started checklist with links to its help pages', async ({ page }) => {
    const panel = new AdministrationPage(page);
    await panel.goto();

    await expect(panel.heading).toHaveText('Administration');
    await expect(panel.checklistItems).toHaveCount(2);
    await expect(panel.checklistItems.first()).toContainText('Configure GitHub sign-in');
    await panel.checklistItems.nth(1).getByRole('link', { name: 'How to do it' }).click();
    await expect(page).toHaveURL('/help/administrator/how-to/configure-email');
  });

  test('the About page shows the version that /health reports', async ({ page, request }) => {
    const health = (await (await request.get('http://localhost:3001/health')).json()) as {
      version: string;
    };
    const panel = new AdministrationPage(page);
    await panel.goto();

    await panel.sections.getByRole('link', { name: 'About' }).click();

    await expect(page).toHaveURL('/admin/about');
    await expect(panel.installedVersion).toHaveText(health.version);
  });

  test('is reached from the navigation of every device', async ({ page }) => {
    const shell = new AppShellPage(page);
    await shell.goto();
    const sideLink = shell.navigation.getByRole('link', { name: 'Administration' });

    if (await sideLink.isVisible()) {
      await sideLink.click();
    } else {
      // Phones: the bottom navigation keeps its slots, the account menu leads to the panel.
      const menu = await shell.openAccountMenu();
      await menu.getByRole('menuitem', { name: 'Administration' }).click();
    }

    await expect(page).toHaveURL('/admin');
  });

  test('passes axe and fits the viewport', async ({ page }) => {
    const panel = new AdministrationPage(page);
    const shell = new AppShellPage(page);
    for (const path of ['/admin', '/admin/about'] as const) {
      await panel.goto(path);
      await expect(panel.heading).toBeVisible();

      expect(await seriousViolations(page)).toEqual([]);
      expect(await shell.horizontalOverflow()).toBe(0);
    }
  });
});

test.describe('Administrator panel for a team member', () => {
  test('is not found and not offered', async ({ page }) => {
    const shell = new AppShellPage(page);
    await shell.goto();
    await expect(shell.heading).toBeVisible();
    await expect(shell.navigation.getByRole('link', { name: 'Administration' })).toHaveCount(0);

    const response = await page.goto('/admin');

    expect(response?.status()).toBe(404);
  });
});
