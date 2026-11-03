import { expect, type Locator, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { ProductTourPage } from './pages/product-tour.page.js';
import { expectTouchTarget, minimumTargetSize } from './touch-targets.js';

/** The horizontal centre of the icon inside an element. */
async function iconCentre(element: Locator): Promise<number> {
  const box = await element.locator('svg').boundingBox();
  return (box?.x ?? 0) + (box?.width ?? 0) / 2;
}

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

  // The skip link appears on the first Tab with its padding: `not-sr-only` resets the padding, so
  // the link sets it with the `focus:` variant (#177).
  test('shows the skip link with padding on the first Tab', async ({ page }) => {
    const skip = page.getByRole('link', { name: 'Skip to main content' });

    await page.locator('body').press('Tab');

    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await expect(skip).toHaveCSS('padding-left', '12px');
    await expect(skip).toHaveCSS('padding-top', '8px');
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

  test.describe('on desktop', () => {
    test.beforeEach(() => {
      test.skip(test.info().project.name !== 'desktop', 'the desktop choice of the navigation');
    });

    test('collapses the side navigation to icons and remembers it in this browser', async ({
      page,
    }) => {
      const main = page.getByRole('main');
      await expect(shell.navigation).toHaveJSProperty('offsetWidth', 240);
      const expandedMainWidth = await main.evaluate((element) => element.clientWidth);

      await shell.toggleNavigation('Collapse navigation');

      await expect(shell.navigation).toHaveJSProperty('offsetWidth', 64);
      await expect(shell.navigationToggle('Expand navigation')).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      // The labels stay the accessible names of the icons.
      await expect(shell.navigation.getByRole('link', { name: 'Home' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(await main.evaluate((element) => element.clientWidth)).toBe(expandedMainWidth + 176);
      // The icon of the toggle stands in the column of the icons of the links.
      expect(await iconCentre(shell.navigationToggle('Expand navigation'))).toBe(
        await iconCentre(shell.navigation.getByRole('link', { name: 'Home' })),
      );
      expect(await seriousViolations(page)).toEqual([]);
      await expectTouchTarget(
        shell.navigationToggle('Expand navigation'),
        minimumTargetSize(test.info()),
        ['height', 'width'],
      );

      // The server renders the remembered width, so the first paint shows no expanded navigation.
      await expect(async () => {
        expect(await (await page.request.get('/')).text()).toContain('xl:w-16');
      }).toPass();
      await page.reload();
      await expect(shell.navigation).toHaveJSProperty('offsetWidth', 64);

      await shell.toggleNavigation('Expand navigation');

      await expect(shell.navigation).toHaveJSProperty('offsetWidth', 240);
      await expect(async () => {
        expect(await (await page.request.get('/')).text()).toContain('xl:w-60');
      }).toPass();
    });

    test('shows the item names as tooltips on the collapsed icons only', async ({ page }) => {
      const projects = shell.navigation.getByRole('link', { name: 'Projects' });
      const tooltip = shell.navigationTooltip('Projects');

      // Expanded, the labels are visible and no tooltip repeats them.
      await projects.hover();
      await page.waitForTimeout(1000); // longer than the delay of the tooltip
      await expect(tooltip).toBeHidden();

      await shell.toggleNavigation('Collapse navigation');
      await expect(shell.navigation).toHaveJSProperty('offsetWidth', 64);

      await projects.hover();
      await expect(tooltip).toBeVisible();
      // Next to the icon, and the link keeps its name without a description (no double reading).
      const [linkBox, tooltipBox] = await Promise.all([
        projects.boundingBox(),
        tooltip.boundingBox(),
      ]);
      expect(tooltipBox?.x).toBeGreaterThan((linkBox?.x ?? 0) + (linkBox?.width ?? 0));
      await expect(projects).not.toHaveAttribute('aria-describedby');
      await tooltip.evaluate((element) =>
        Promise.all(
          element.getAnimations({ subtree: true }).map((animation) => animation.finished),
        ),
      );
      expect(await seriousViolations(page)).toEqual([]);

      await page.keyboard.press('Escape');
      await expect(tooltip).toBeHidden();

      // Keyboard focus shows it too.
      await page.mouse.move(800, 600);
      await projects.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(projects).toBeFocused();
      await expect(tooltip).toBeVisible();

      await shell.toggleNavigation('Expand navigation');
    });

    test('highlights the collapsed navigation in the getting-started tour', async ({ page }) => {
      const tour = new ProductTourPage(page);
      await shell.toggleNavigation('Collapse navigation');
      await expect(shell.navigation).toHaveJSProperty('offsetWidth', 64);

      const menu = await shell.openHelpMenu();
      await menu.getByRole('menuitem', { name: 'Take the tour: Getting started' }).click();
      await tour.next.click();

      await expect(tour.step(2, 4)).toBeVisible();
      await expect(tour.highlighted()).toHaveAttribute('data-tour', 'app-shell-navigation');
      await page.keyboard.press('Escape');
    });
  });
});
