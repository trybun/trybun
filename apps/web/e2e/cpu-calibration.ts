import type { BrowserContext, CDPSession, Page } from '@playwright/test';
import { pageFunctions } from 'lighthouse/core/lib/page-functions.js';

/**
 * The benchmark index of the device the Lighthouse budget emulates: a mid-tier phone ("like a
 * Pixel 5"), the target of the CPU throttling calibration of Chrome DevTools (#508). The index is
 * Lighthouse's `computeBenchmarkIndex`, whose definition can change with Chromium: compare the
 * calibrated multipliers of the reports after every upgrade of Playwright's Chromium.
 */
export const TARGET_BENCHMARK_INDEX = 1_000;

/** How close the throttled index has to come to the target (DevTools: within 10 of 1000). */
const TOLERANCE = 0.05;
/** Unthrottled readings agree when they are this close; a cold first launch reads low. */
const AGREEMENT = 0.1;
const MAX_UNTHROTTLED_READINGS = 6;
const MAX_STEPS = 6;

/** One step of the calibration: the throttling rate and the index measured under it. */
interface Step {
  readonly rate: number;
  readonly benchmarkIndex: number;
}

/** The result of the calibration, attached to the report of each key page. */
export interface CpuCalibration {
  readonly targetBenchmarkIndex: number;
  readonly unthrottledReadings: readonly number[];
  readonly steps: readonly Step[];
  /** The `throttling.cpuSlowdownMultiplier` of the Lighthouse runs. */
  readonly cpuSlowdownMultiplier: number;
}

const BENCHMARK = `(${pageFunctions.computeBenchmarkIndex.toString()})()`;

async function benchmark(page: Page, cdp: CDPSession, rate: number): Promise<number> {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  return Math.round(await page.evaluate<number>(BENCHMARK));
}

/**
 * Calibrates the CPU slowdown so that the runner emulates the device of
 * {@link TARGET_BENCHMARK_INDEX}, the method of Chrome DevTools: the rate is corrected until the
 * benchmark index measured under it comes close to the target. A fixed multiplier would emulate a
 * slower device on a slower runner: with 4× the TBT of one build fell into bands by the CPU class
 * of GitHub's runners (#508). Throws when the runner is slower than the target or the rate does
 * not converge, and never falls back to a fixed multiplier.
 */
export async function calibrateCpuSlowdown(context: BrowserContext): Promise<CpuCalibration> {
  const page = await context.newPage();
  try {
    const cdp = await context.newCDPSession(page);
    const unthrottledReadings = [await benchmark(page, cdp, 1)];
    for (;;) {
      const reading = await benchmark(page, cdp, 1);
      const previous = unthrottledReadings.at(-1) ?? reading;
      unthrottledReadings.push(reading);
      if (Math.abs(reading - previous) <= AGREEMENT * Math.max(reading, previous)) break;
      if (unthrottledReadings.length >= MAX_UNTHROTTLED_READINGS) {
        throw new Error(
          `The unthrottled benchmark index does not settle: ${unthrottledReadings.join(', ')}.`,
        );
      }
    }
    const unthrottled = Math.max(...unthrottledReadings.slice(-2));
    if (unthrottled < TARGET_BENCHMARK_INDEX) {
      throw new Error(
        `The runner (benchmark index ${String(unthrottled)}) is slower than the emulated device ` +
          `(${String(TARGET_BENCHMARK_INDEX)}).`,
      );
    }

    const steps: Step[] = [];
    let rate = unthrottled / TARGET_BENCHMARK_INDEX;
    for (let step = 1; step <= MAX_STEPS; step++) {
      const benchmarkIndex = await benchmark(page, cdp, rate);
      steps.push({ rate, benchmarkIndex });
      if (Math.abs(benchmarkIndex - TARGET_BENCHMARK_INDEX) <= TOLERANCE * TARGET_BENCHMARK_INDEX) {
        // Lighthouse applies the multiplier itself.
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        return {
          targetBenchmarkIndex: TARGET_BENCHMARK_INDEX,
          unthrottledReadings,
          steps,
          cpuSlowdownMultiplier: Number(rate.toFixed(3)),
        };
      }
      rate = Math.max(1, (rate * benchmarkIndex) / TARGET_BENCHMARK_INDEX);
    }
    throw new Error(
      `The CPU slowdown does not converge to the benchmark index ` +
        `${String(TARGET_BENCHMARK_INDEX)}: ${JSON.stringify(steps)}.`,
    );
  } finally {
    await page.close();
  }
}
