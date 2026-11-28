import { appendFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { availableParallelism, loadavg, tmpdir } from 'node:os';
import { join } from 'node:path';
import { type BrowserContextOptions, chromium, expect, test } from '@playwright/test';
import lighthouse, { type Result } from 'lighthouse';
import { type CpuCalibration, calibrateCpuSlowdown } from './cpu-calibration.js';
import { TEAM_STORAGE_STATE } from './storage-state.js';

/**
 * The performance budget of the key pages, mobile profile of Lighthouse with applied throttling and
 * the CPU slowdown calibrated to a mid-tier phone (§2.9).
 */
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
 * Lighthouse runs per key page. Each value of the budget applies to its median over the runs, so
 * that a single slow run does not decide it: TBT measures the real main thread at the
 * calibrated CPU slowdown and moves with whatever else the runner does (#146, #508). The LCP of applied throttling
 * varies by ~50 ms between runs of one build (#503).
 */
const RUNS = 3;

/** The middle value of an odd number of runs. */
function median(values: readonly number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? Number.NaN;
}

type StorageState = Exclude<BrowserContextOptions['storageState'], string | undefined>;

/**
 * The file of the run's calibrations, in the output folder of Playwright, which every run empties.
 * CI prints it to the job log and the job summary after the tests (#579): after an upgrade of
 * Playwright's Chromium, its pull request compares the multipliers with those of earlier runs
 * (open question 2 of #508). The job log can be read with `gh run view --log` and is not
 * Actions storage, while the report is uploaded only for a failed run.
 */
const CALIBRATION_FILE = 'lighthouse-calibration.md';

/** Appends the calibration of a key page and the medians of its runs to the calibration file. */
async function appendCalibration(
  folder: string,
  page: string,
  calibration: CpuCalibration,
  runner: { loadAverage: number[]; parallelism: number },
  runs: readonly Result[],
  medians: { performance: number; lcpMs: number; tbtMs: number },
): Promise<void> {
  const chromiumVersion =
    /Chrome\/([\d.]+)/.exec(runs[0]?.environment.hostUserAgent ?? '')?.[1] ?? '?';
  const [low, high] = calibration.rateInterval;
  const rows = [
    ['Chromium', chromiumVersion],
    ['CPU slowdown multiplier', calibration.cpuSlowdownMultiplier.toFixed(2)],
    ['95 % interval of the rate', `${low.toFixed(2)}–${high.toFixed(2)}`],
    ['Unthrottled benchmark index (median)', median(calibration.unthrottledReadings).toFixed(0)],
    ['Throttled readings', String(calibration.steps.length)],
    [
      'Benchmark index of the runs',
      runs.map((run) => run.environment.benchmarkIndex.toFixed(0)).join(', '),
    ],
    ['Load average (1, 5, 15 min)', runner.loadAverage.map((load) => load.toFixed(2)).join(', ')],
    ['Parallelism', String(runner.parallelism)],
    ['Performance (median)', medians.performance.toFixed(2)],
    ['LCP, TBT (median, ms)', `${medians.lcpMs.toFixed(0)}, ${medians.tbtMs.toFixed(0)}`],
  ];
  const table = rows.map(([label, value]) => `| ${label ?? ''} | ${value ?? ''} |`).join('\n');
  await mkdir(folder, { recursive: true });
  await appendFile(
    join(folder, CALIBRATION_FILE),
    `### Lighthouse CPU calibration: ${page}\n\n| | |\n|---|---|\n${table}\n\n`,
  );
}

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

      // Calibrated in the Chromium that Lighthouse drives, before its runs (#508).
      const calibration = await calibrateCpuSlowdown(browser);
      // With the load of the runner, which explains a noisy calibration (#523).
      const runner = { loadAverage: loadavg(), parallelism: availableParallelism() };
      await testInfo.attach('cpu-calibration.json', {
        body: JSON.stringify({ ...calibration, runner }, null, 2),
        contentType: 'application/json',
      });

      const runs: Result[] = [];
      for (let run = 1; run <= RUNS; run++) {
        const result = await lighthouse(`${baseURL ?? ''}${keyPage.path}`, {
          port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: ['performance', 'accessibility'],
          blockedUrlPatterns: keyPage.blockedUrlPatterns,
          // Applied throttling (#503): the page loads at the speed of the mobile profile. The
          // default simulation (Lantern) computes it from an unthrottled load, and on localhost
          // its LCP lands on steps ~1 s apart for one build.
          throttlingMethod: 'devtools',
          throttling: { cpuSlowdownMultiplier: calibration.cpuSlowdownMultiplier },
        });
        expect(result).toBeDefined();
        if (result === undefined) continue;
        runs.push(result.lhr);
        await testInfo.attach(`lighthouse-report-${String(run)}.json`, {
          body: typeof result.report === 'string' ? result.report : '',
          contentType: 'application/json',
        });
        // The emulated device holds only while the runner keeps its speed: the benchmark index of each
        // run goes into the report, without a gate (open question 1 of the specification of #508).
        testInfo.annotations.push({
          type: 'benchmark index',
          description: `run ${String(run)}: ${String(result.lhr.environment.benchmarkIndex)}`,
        });
        // Measured on the key page itself, not on a page it redirects to.
        expect(result.lhr.finalDisplayedUrl).toBe(`${baseURL ?? ''}${keyPage.path}`);
      }

      const score = (category: string) =>
        median(runs.map(({ categories }) => categories[category]?.score ?? 0));
      const metric = (audit: string) =>
        median(runs.map(({ audits }) => audits[audit]?.numericValue ?? Number.POSITIVE_INFINITY));
      await appendCalibration(testInfo.project.outputDir, keyPage.name, calibration, runner, runs, {
        performance: score('performance'),
        lcpMs: metric('largest-contentful-paint'),
        tbtMs: metric('total-blocking-time'),
      });
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
