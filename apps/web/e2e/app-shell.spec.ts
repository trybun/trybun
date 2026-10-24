import { expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';

test.describe('application shell', () => {
  let shell: AppShellPage;

  test.beforeEach(async ({ page }) => {
    shell = new AppShellPage(page);
    await shell.goto();
    await expect(shell.heading).toHaveText('Home');
  });

  test('fits the viewport without horizontal scroll', async () => {
    await expect(shell.header).toBeVisible();
    expect(await shell.horizontalOverflow()).toBe(0);
  });

  test('shows the main navigation of the viewport', async ({ page }, testInfo) => {
    await expect(shell.navigation).toHaveCount(1);
    await expect(shell.navigation.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const box = await shell.navigation.boundingBox();
    const viewport = page.viewportSize();
    if (testInfo.project.name === 'phone') {
      // The bottom navigation of phones (§2.9).
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBe(viewport?.height);
    } else {
      // The side navigation from the tablet width on.
      expect(box?.x).toBe(0);
    }
  });

  test('shows the signed-in account in the user menu', async () => {
    const menu = await shell.openAccountMenu();

    await expect(menu).toContainText('Dorota Developer');
    await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  });

  test('switches the language without loading another URL', async ({ page }) => {
    const url = page.url();
    const menu = await shell.openAccountMenu();

    await menu.getByRole('menuitemradio', { name: 'Polski' }).click();

    await expect(shell.heading).toHaveText('Strona główna');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    expect(page.url()).toBe(url);
  });

  test('has no serious accessibility violations', async ({ page }) => {
    expect(await seriousViolations(page)).toEqual([]);

    await shell.openAccountMenu();

    expect(await seriousViolations(page)).toEqual([]);
  });

  test('has touch targets of at least 44 px', async () => {
    // The compact sizes of a precise pointer apply only on desktop (§18.6).
    const minimum = test.info().project.name === 'desktop' ? 32 : 44;
    for (const target of [
      shell.accountMenu,
      shell.navigation.getByRole('link', { name: 'Home' }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(minimum);
      expect(box?.width).toBeGreaterThanOrEqual(minimum);
    }
  });
});
