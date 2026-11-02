import { devices, expect, type Page, test } from '@playwright/test';
import { PRODUCT_TOURS } from '../src/features/product-tours/tours/index.js';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { ProductTourPage } from './pages/product-tour.page.js';
import { ADMIN_STORAGE_STATE, NEWCOMER_STORAGE_STATE } from './storage-state.js';

const PHONE = { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } };
const DESKTOP = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } };

/**
 * The page of a view with route parameters: a record of the demo dataset – the organization is
 * `demoId(400)` of `apps/server/prisma/demo-dataset.ts`.
 */
const PATHS_OF_VIEWS: Readonly<Record<string, string>> = {
  '/admin/organizations/[organizationId]':
    '/admin/organizations/019b8d00-0000-7000-8000-000000000190',
};

/** The views of the Administrator panel, which only the Administrator opens (§15.6). */
function isAdministration(view: string): boolean {
  return view === '/admin' || view.startsWith('/admin/');
}

/** Checks that every step of the tours targets one visible element of its view. */
async function expectTourTargets(
  page: Page,
  tours: readonly (typeof PRODUCT_TOURS)[number][],
): Promise<void> {
  const tour = new ProductTourPage(page);
  for (const { view, steps } of tours) {
    const path = PATHS_OF_VIEWS[view] ?? view;
    expect(path, `add a page of ${view} to PATHS_OF_VIEWS`).not.toContain('[');
    await page.goto(path);
    for (const { target } of steps) {
      if (target !== undefined) {
        await expect(tour.target(target), `data-tour="${target}" on ${view}`).toHaveCount(1);
      }
    }
  }
}

test.describe('product tours', () => {
  // The signed-in team member has completed every tour (demo dataset), so none starts by itself.
  test('every step targets an element of its view', async ({ page }) => {
    // The end-user portal does not exist yet; its first tour signs in as an end user here.
    expect(PRODUCT_TOURS.map((tour) => tour.audience)).not.toContain('end_user');
    await expectTourTargets(
      page,
      PRODUCT_TOURS.filter((tour) => !isAdministration(tour.view)),
    );
  });

  test.describe('of the Administrator panel', () => {
    test.use({ storageState: ADMIN_STORAGE_STATE });

    // Optional steps included: the Administrator may perform every action of the demo records.
    test('every step targets an element of its view', async ({ page }) => {
      await expectTourTargets(
        page,
        PRODUCT_TOURS.filter((tour) => isAdministration(tour.view)),
      );
    });

    // A target the tour scrolls to ended flush with the viewport edge, cutting its ring off (#191).
    test('scrolls a target into view with its whole ring', async ({ page }) => {
      const shell = new AppShellPage(page);
      const tour = new ProductTourPage(page);
      // Low enough that the targets below the domains are below the fold on every device.
      const width = page.viewportSize()?.width ?? 0;
      await page.setViewportSize({ width, height: 600 });
      await page.goto(PATHS_OF_VIEWS['/admin/organizations/[organizationId]'] ?? '');

      const menu = await shell.openHelpMenu();
      await menu.getByRole('menuitem', { name: 'Take the tour: Organization' }).click();
      await expect(tour.step(1, 3)).toBeVisible();

      for (const [step, target] of [
        [2, 'organization-detail-projects'],
        [3, 'organization-detail-add-member'],
      ] as const) {
        await tour.next.click();
        await expect(tour.step(step, 3)).toBeVisible();
        await expect(tour.highlighted()).toHaveAttribute('data-tour', target);
        // The ring outside the target, not inside it: the scroll leaves room for it.
        await expect.poll(() => tour.highlightedOutlineOffset()).toBeGreaterThan(0);
        // The box plus the 5 px ring between the sticky header and the bottom of the viewport –
        // above the bottom navigation of phones – once the scroll (smooth or instant) settles.
        await expect
          .poll(async () => {
            const box = await tour.highlighted().boundingBox();
            const header = await page.locator('header').first().boundingBox();
            const navigation = await page
              .locator('[data-tour="app-shell-navigation"]')
              .filter({ visible: true })
              .boundingBox();
            if (box === null || header === null) {
              return false;
            }
            const bottomEdge = width < 768 && navigation !== null ? navigation.y : 600;
            return (
              box.y - 5 >= header.y + header.height &&
              box.y + box.height + 5 <= bottomEdge &&
              box.x - 5 >= 0 &&
              box.x + box.width + 5 <= width
            );
          })
          .toBe(true);
      }
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

      // Closed with Esc: Done would record the tour for the Administrator of every project.
      await page.keyboard.press('Escape');
      await expect(tour.tip).toBeHidden();
    });
  });

  test('closes with Esc and starts again from the help menu', async ({ page }) => {
    const shell = new AppShellPage(page);
    const tour = new ProductTourPage(page);
    await shell.goto();

    const menu = await shell.openHelpMenu();
    await menu.getByRole('menuitem', { name: 'Take the tour: Getting started' }).click();

    await expect(tour.step(1, 4)).toBeVisible();
    await expect(tour.next).toBeFocused();
    await tour.next.click();
    await expect(tour.step(2, 4)).toBeVisible();
    await expect(tour.highlighted()).toHaveAttribute('data-tour', 'app-shell-navigation');
    expect(await seriousViolations(page)).toEqual([]);

    await page.keyboard.press('Escape');

    await expect(tour.tip).toBeHidden();
    await expect(tour.highlighted()).toHaveCount(0);
  });

  // A visible ring, not only the attribute: `outline-none` of a Button target removed it (#186).
  test('marks the target of every step with a ring', async ({ page }) => {
    const shell = new AppShellPage(page);
    const tour = new ProductTourPage(page);
    await shell.goto();

    const menu = await shell.openHelpMenu();
    await menu.getByRole('menuitem', { name: 'Take the tour: Getting started' }).click();
    await expect(tour.step(1, 4)).toBeVisible();

    // The navigation touches an edge of the screen on every device – the bottom of phones, the
    // left of larger screens – so its ring sits inside it, where the edge cannot cut it off (#196).
    for (const [step, target, isInset] of [
      [2, 'app-shell-navigation', true],
      [3, 'app-header-help', false],
      [4, 'app-header-account-menu', false],
    ] as const) {
      await tour.next.click();
      await expect(tour.step(step, 4)).toBeVisible();
      await expect(tour.highlighted()).toHaveAttribute('data-tour', target);
      await expect(tour.highlighted()).toHaveCSS('outline-style', 'solid');
      // The sign, not the exact length: Chrome may snap it to device pixels, as the width below.
      const outlineOffset = () =>
        tour.highlighted().evaluate((el) => parseFloat(getComputedStyle(el).outlineOffset));
      if (isInset) {
        await expect.poll(outlineOffset).toBeLessThan(0);
      } else {
        await expect.poll(outlineOffset).toBeGreaterThan(0);
      }
      // Chrome snaps the 3 px width to device pixels: 2.8px on the tablet's fractional pixel ratio.
      await expect
        .poll(() =>
          tour.highlighted().evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth)),
        )
        .toBeGreaterThanOrEqual(2.5);
    }

    // Closed with Esc, as above: Done would record the tour again for the account all projects share.
    await page.keyboard.press('Escape');
    await expect(tour.tip).toBeHidden();
    await expect(tour.highlighted()).toHaveCount(0);
  });

  // The tip stayed next to the previous step's target while it stayed open (#188).
  test('shows the tip next to the target of every step', async ({ page }) => {
    // The tip is a popover from the tablet breakpoint (48rem); below it, a sheet at the edge. The
    // iPad (gen 11) of the tablet project is 656 px wide in portrait, so it shows the sheet too.
    test.skip(
      (page.viewportSize()?.width ?? 0) < 768,
      'Below the tablet breakpoint the tip is a sheet at the edge.',
    );

    const shell = new AppShellPage(page);
    const tour = new ProductTourPage(page);
    await shell.goto();

    const menu = await shell.openHelpMenu();
    await menu.getByRole('menuitem', { name: 'Take the tour: Getting started' }).click();
    await expect(tour.step(1, 4)).toBeVisible();
    await tour.next.click();
    await expect(tour.step(2, 4)).toBeVisible();

    for (const [step, target] of [
      [3, 'app-header-help'],
      [4, 'app-header-account-menu'],
    ] as const) {
      await tour.next.click();
      await expect(tour.step(step, 4)).toBeVisible();
      // Below the header button, at most 16 px away, and overlapping it horizontally.
      await expect
        .poll(async () => {
          const tip = await tour.tip.boundingBox();
          const button = await tour.target(target).boundingBox();
          if (tip === null || button === null) {
            return false;
          }
          const gap = tip.y - (button.y + button.height);
          return (
            gap >= 0 && gap <= 16 && tip.x < button.x + button.width && tip.x + tip.width > button.x
          );
        })
        .toBe(true);
    }

    // Closed with Esc: Done would record the tour again for the account all projects share.
    await page.keyboard.press('Escape');
    await expect(tour.tip).toBeHidden();
  });

  // One person on two devices: the test opens both itself, so it runs in one project only.
  test('a tour completed on desktop does not start again on a phone', async ({ browser }) => {
    test.skip(test.info().project.name !== 'desktop', 'The test switches devices itself.');

    const desktop = await browser.newContext({ ...DESKTOP, storageState: NEWCOMER_STORAGE_STATE });
    const desktopPage = await desktop.newPage();
    const desktopTour = new ProductTourPage(desktopPage);
    await new AppShellPage(desktopPage).goto();

    // The tour of the first visit starts by itself.
    await expect(desktopTour.step(1, 4)).toBeVisible();
    for (const step of [2, 3, 4]) {
      await desktopTour.next.click();
      await expect(desktopTour.step(step, 4)).toBeVisible();
    }
    const recorded = desktopPage.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/users/me/product-tours/first_login') &&
        response.request().method() === 'PUT',
    );
    await desktopTour.done.click();
    await expect(desktopTour.tip).toBeHidden();
    expect((await recorded).status()).toBe(200);
    await desktop.close();

    const phone = await browser.newContext({ ...PHONE, storageState: NEWCOMER_STORAGE_STATE });
    const phonePage = await phone.newPage();
    const phoneShell = new AppShellPage(phonePage);
    const phoneTour = new ProductTourPage(phonePage);
    await phoneShell.goto();
    // The help menu opens once the page is interactive – a tour would have started by then.
    const menu = await phoneShell.openHelpMenu();
    await expect(phoneTour.tip).toHaveCount(0);

    // The tour can still be taken again: as a sheet on the phone, closed with Esc.
    await menu.getByRole('menuitem', { name: 'Take the tour: Getting started' }).click();
    await expect(phoneTour.step(1, 4)).toBeVisible();
    const box = await phoneTour.tip.boundingBox();
    expect(box?.width).toBe(PHONE.viewport.width);
    await phonePage.keyboard.press('Escape');
    await expect(phoneTour.tip).toBeHidden();
    await phone.close();
  });
});
