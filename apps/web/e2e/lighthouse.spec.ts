import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type BrowserContextOptions, chromium, expect, test } from '@playwright/test';
import lighthouse from 'lighthouse';
import { computeMedianRun } from 'lighthouse/core/lib/median-run.js';
import { TEAM_STORAGE_STATE } from './storage-state.js';

/** The performance budget of the key pages, mobile profile of Lighthouse (§2.9). */
const BUDGET = {
  performance: 0.9,
  accessibility: 0.9,
  largestContentfulPaintMs: 2_500,
  totalBlockingTimeMs: 200,
  cumulativeLayoutShift: 0.1,
};

/**
 * The key pages of Stage 0 (§2.9); later tasks add theirs. The sign-in redirect is measured
 * without the sign-in request of Auth.js, so that the report covers the page of the web
 * application rather than the login screen of Keycloak it leads to.
 */
const KEY_PAGES = [
  { name: 'the empty application shell', path: '/', isSignedIn: true, blockedUrlPatterns: [] },
  {
    name: 'the sign-in redirect',
    path: '/sign-in',
    isSignedIn: false,
    blockedUrlPatterns: ['*/api/auth/signin/*'],
  },
];

/**
 * Lighthouse runs per key page; the budget applies to the median run, as Lighthouse recommends
 * against the variance of a single run (#146).
 */
const RUNS = 3;

type StorageState = Exclude<BrowserContextOptions['storageState'], string | undefined>;

for (const keyPage of KEY_PAGES) {
  test(`${keyPage.name} meets the mobile budget`, async ({ baseURL }, testInfo) => {
    // Lighthouse loads and throttles the page several times in each of its runs.
    test.setTimeout(RUNS * 120_000);
    // Lighthouse drives a Chromium of Playwright over the DevTools protocol, in its default
    // context, which therefore carries the session cookie.
    const port = 9_222 + testInfo.workerIndex;
    const profile = await mkdtemp(join(tmpdir(), 'trybun-lighthouse-'));
    const browser = await chromium.launchPersistentContext(profile, {
      args: [`--remote-debugging-port=${port}`],
    });
    try {
      if (keyPage.isSignedIn) {
        const state = JSON.parse(await readFile(TEAM_STORAGE_STATE, 'utf8')) as StorageState;
        await browser.addCookies(state.cookies);
      }

      const runs = [];
      for (let run = 0; run < RUNS; run++) {
        const result = await lighthouse(`${baseURL ?? ''}${keyPage.path}`, {
          port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: ['performance', 'accessibility'],
          blockedUrlPatterns: keyPage.blockedUrlPatterns,
        });
        expect(result).toBeDefined();
        if (result !== undefined) runs.push(result);
      }

      const median = computeMedianRun(runs.map(({ lhr }) => lhr));
      const { categories, audits, finalDisplayedUrl } = median;
      const report = runs.find(({ lhr }) => lhr === median)?.report;
      await testInfo.attach('lighthouse-report.json', {
        body: typeof report === 'string' ? report : '',
        contentType: 'application/json',
      });
      // Measured on the key page itself, not on a page it redirects to.
      expect(finalDisplayedUrl).toBe(`${baseURL ?? ''}${keyPage.path}`);
      const score = (category: string) => categories[category]?.score ?? 0;
      const metric = (audit: string) => audits[audit]?.numericValue ?? Number.POSITIVE_INFINITY;
      expect.soft(score('performance'), 'Performance').toBeGreaterThanOrEqual(BUDGET.performance);
      expect
        .soft(score('accessibility'), 'Accessibility')
        .toBeGreaterThanOrEqual(BUDGET.accessibility);
      expect
        .soft(metric('largest-contentful-paint'), 'LCP (ms)')
        .toBeLessThan(BUDGET.largestContentfulPaintMs);
      expect
        .soft(metric('total-blocking-time'), 'TBT (ms)')
        .toBeLessThan(BUDGET.totalBlockingTimeMs);
      expect
        .soft(metric('cumulative-layout-shift'), 'CLS')
        .toBeLessThan(BUDGET.cumulativeLayoutShift);
    } finally {
      await browser.close();
      await rm(profile, { recursive: true, force: true });
    }
  });
}
