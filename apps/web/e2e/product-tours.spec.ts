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
