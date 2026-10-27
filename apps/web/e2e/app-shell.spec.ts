import { expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { expectTouchTarget, minimumTargetSize } from './touch-targets.js';

test.describe('application shell', () => {
  let shell: AppShellPage;

  test.beforeEach(async ({ page }) => {
    shell = new AppShellPage(page);
    await shell.goto();
    await expect(shell.heading).toHaveText('Home');
  });

  test('embeds no texts of a feature in the empty shell', async ({ page }) => {
    const html = await (await page.request.get('/')).text();

    expect(html).toContain('Home');
    // A text of the `projects` namespace (§18.5): only the project views pass it to the browser.
    expect(html.includes('No projects yet.'), 'a text of the project views').toBe(false);
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
    const minimum = minimumTargetSize(test.info());
    for (const target of [
      shell.accountMenu,
      shell.navigation.getByRole('link', { name: 'Home' }),
    ]) {
      await expectTouchTarget(target, minimum, ['height', 'width']);
    }
  });
});
