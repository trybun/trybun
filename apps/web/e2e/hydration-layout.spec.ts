import { expect, type Locator, type Page, test } from '@playwright/test';
import { OrganizationsPage } from './pages/organizations.page.js';
import { ProjectsPage } from './pages/projects.page.js';
import { ADMIN_STORAGE_STATE } from './storage-state.js';

/**
 * The lists under a server-rendered trigger of a lazily loaded dialog, and the buttons of the
 * header's lazily loaded menus, keep their place while the page hydrates (#308, #311, §18.5,
 * Rule 9). The trigger vanished when the page hydrated – its `<Suspense>` had no fallback – so the
 * list moved up between `pointerdown` and `pointerup` and a tap opened nothing or the row below.
 * The pending invitations of an account, loaded only in the browser, pushed the rows below it down
 * the same way (#310), so the last row is sampled too. The defect needs slow chunks, so every chunk
 * is delayed: delaying only the chunks after `load` does not delay the hydration
 * (`.ai/memory/e2e.md`).
 */
const CHUNK_DELAY_MS = 1500;

/** When the row is tapped after `domcontentloaded`: in the middle of the hydration (#308). */
const TAP_AFTER_MS = 1200;

interface List {
  readonly path: string;
  /** The accessible name of the trigger above the list. */
  readonly trigger: string;
  /**
   * The CSS selector of the rows; the first visible match is the first row. The init script runs
   * in the page, where the locators of the page objects do not exist (§18.7).
   */
  readonly rows: string;
  /** The link of a seeded row that opens its detail, when a row opens one. */
  readonly row?: (page: Page) => Locator;
}

/** The cards of the Accounts page on phones, the rows of its table from the tablet on. */
const ACCOUNT_ROWS = 'ul[aria-label="Accounts"] > li, main table tr:has(th[scope="row"])';

const LISTS: readonly List[] = [
  {
    path: '/admin/organizations',
    trigger: 'New organization',
    rows: 'main li > a[href^="/admin/organizations/"]',
    row: (page) => new OrganizationsPage(page).organization('Customer company'),
  },
  {
    path: '/projects',
    trigger: 'New project',
    rows: 'main li > a[href^="/projects/"][href$="/settings"]',
    row: (page) => new ProjectsPage(page).project('Customer portal'),
  },
  {
    // The cards on phones, the rows of the table from the tablet on; an account opens no detail.
    path: '/admin/accounts',
    trigger: 'Invite',
    rows: ACCOUNT_ROWS,
  },
  {
    // The demo dataset's invited end user has a pending invitation here (#310).
    path: '/admin/accounts?state=invited',
    trigger: 'Invite',
    rows: ACCOUNT_ROWS,
  },
];

interface Sample {
  readonly trigger: number | null;
  readonly row: number | null;
  /** The last row moves when a row above it grows, e.g. by its pending invitations (#310). */
  readonly lastRow: number | null;
}

/**
 * Records the `top` of the trigger, of the first and of the last row on every DOM change and every
 * frame from the first paint on – before it, the stylesheets are still loading and the layout is
 * not the one shown.
 */
async function recordLayout(page: Page, list: List): Promise<() => Promise<Sample[]>> {
  await page.addInitScript(
    ({ trigger, rows }) => {
      const samples: { trigger: number | null; row: number | null; lastRow: number | null }[] = [];
      Object.assign(window, { layoutSamples: samples });
      const isVisible = (element: Element) => element.getClientRects().length > 0;
      // By the accessible name: an invited account's own Invite has the same text but is named
      // after its address (`aria-label`), and must not stand in for the vanished trigger.
      const nameOf = (element: Element) =>
        element.getAttribute('aria-label') ?? element.textContent?.trim();
      const sample = () => {
        const button = [...document.querySelectorAll('main button')].find(
          (element) => nameOf(element) === trigger && isVisible(element),
        );
        const visibleRows = [...document.querySelectorAll(rows)].filter(isVisible);
        samples.push({
          trigger: button?.getBoundingClientRect().top ?? null,
          row: visibleRows[0]?.getBoundingClientRect().top ?? null,
          lastRow: visibleRows.at(-1)?.getBoundingClientRect().top ?? null,
        });
      };
      const everyFrame = () => {
        sample();
        requestAnimationFrame(everyFrame);
      };
      requestAnimationFrame(() => {
        new MutationObserver(sample).observe(document, {
          childList: true,
          subtree: true,
          attributes: true,
        });
        everyFrame();
      });
    },
    { trigger: list.trigger, rows: list.rows },
  );
  return () =>
    page.evaluate(() => (window as unknown as { layoutSamples: Sample[] }).layoutSamples);
}

/** Delays every chunk of the application, so the page stays server-rendered for a while. */
async function delayChunks(page: Page): Promise<void> {
  await page.route('**/_next/static/chunks/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
    await route.fallback();
  });
}

test.describe('lists while the page hydrates', () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test.beforeEach(({ isMobile }) => {
    // The defect showed under the finger; the desktop project would only repeat the same build.
    test.skip(!isMobile, 'the phone and tablet projects cover the hydration of the lists');
  });

  for (const list of LISTS) {
    test(`of ${list.path} keep the trigger, the first and the last row in place`, async ({
      page,
    }) => {
      await delayChunks(page);
      const samples = await recordLayout(page, list);

      await page.goto(list.path, { waitUntil: 'domcontentloaded' });
      // Every chunk, the lazy dialog's too, has loaded and the page has hydrated.
      await page.waitForLoadState('networkidle');

      const painted = await samples();
      const first = painted.findIndex((entry) => entry.row !== null);
      expect(first, 'the first row is painted').toBeGreaterThanOrEqual(0);
      const shown = painted.slice(first);
      const missing = shown.filter((entry) => entry.trigger === null).length;
      expect(missing, `samples without the trigger, of ${shown.length}`).toBe(0);
      expect([...new Set(shown.map((entry) => entry.row))], 'tops of the first row').toEqual([
        shown[0]!.row,
      ]);
      expect([...new Set(shown.map((entry) => entry.lastRow))], 'tops of the last row').toEqual([
        shown[0]!.lastRow,
      ]);
    });

    const rowOf = list.row;
    if (rowOf !== undefined) {
      test(`of ${list.path} open the row tapped during the hydration`, async ({ page }) => {
        await delayChunks(page);
        await page.goto(list.path, { waitUntil: 'domcontentloaded' });
        const row = rowOf(page);
        const href = await row.getAttribute('href');
        expect(href, 'the link of the row').not.toBeNull();
        await page.waitForTimeout(TAP_AFTER_MS);

        await row.tap();

        // The detail of the tapped row itself, not of the row below it (#308).
        await expect.poll(() => new URL(page.url()).pathname).toBe(href);
      });
    }
  }
});

/**
 * The buttons of the header the product tours target (§2.4), from left to right: Help and the
 * account menu (#311).
 */
const HEADER_TRIGGERS = ['app-header-help', 'app-header-account-menu'] as const;

/** The `left` of each header trigger, `null` while it is missing. */
type HeaderSample = Readonly<Record<(typeof HEADER_TRIGGERS)[number], number | null>>;

/** Records the `left` of the header triggers like `recordLayout()`, from the first paint on. */
async function recordHeader(page: Page): Promise<() => Promise<HeaderSample[]>> {
  await page.addInitScript((triggers) => {
    const samples: Record<string, number | null>[] = [];
    Object.assign(window, { headerSamples: samples });
    const sample = () => {
      samples.push(
        Object.fromEntries(
          triggers.map((tour) => {
            const element = document.querySelector(`header [data-tour="${tour}"]`);
            const isVisible = element !== null && element.getClientRects().length > 0;
            return [tour, isVisible ? element.getBoundingClientRect().left : null];
          }),
        ),
      );
    };
    const everyFrame = () => {
      sample();
      requestAnimationFrame(everyFrame);
    };
    requestAnimationFrame(() => {
      new MutationObserver(sample).observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
      });
      everyFrame();
    });
  }, HEADER_TRIGGERS);
  return () =>
    page.evaluate(() => (window as unknown as { headerSamples: HeaderSample[] }).headerSamples);
}

test.describe('header while the page hydrates', () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'the phone and tablet projects cover the hydration of the header');
  });

  // The menus load after the first paint (#72); their server-rendered buttons must not vanish
  // while the page hydrates, or the header items move and a tour loses its target (#311).
  test('keeps the Help and account buttons in place', async ({ page }) => {
    await delayChunks(page);
    const samples = await recordHeader(page);

    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    // Every chunk, the lazy menus' too, has loaded and the page has hydrated.
    await page.waitForLoadState('networkidle');

    const painted = await samples();
    const first = painted.findIndex((entry) =>
      HEADER_TRIGGERS.every((tour) => entry[tour] !== null),
    );
    expect(first, 'both buttons are painted').toBeGreaterThanOrEqual(0);
    const shown = painted.slice(first);
    for (const tour of HEADER_TRIGGERS) {
      const missing = shown.filter((entry) => entry[tour] === null).length;
      // Soft, so a run reports each button that moved, not only the first.
      expect.soft(missing, `samples without ${tour}, of ${shown.length}`).toBe(0);
      expect
        .soft([...new Set(shown.map((entry) => entry[tour]))], `left of ${tour}`)
        .toEqual([shown[0]![tour]]);
    }
  });
});
