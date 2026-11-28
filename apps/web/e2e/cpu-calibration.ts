import type { BrowserContext, CDPSession, Page } from '@playwright/test';
import { pageFunctions } from 'lighthouse/core/lib/page-functions.js';

/**
 * The benchmark index of the device the Lighthouse budget emulates: a mid-tier phone ("like a
 * Pixel 5"), the target of the CPU throttling calibration of Chrome DevTools (#508). The index is
 * Lighthouse's `computeBenchmarkIndex`, whose definition can change with Chromium: compare the
 * calibrated multipliers of the CI job summaries (#579) after every upgrade of Playwright's Chromium.
 */
export const TARGET_BENCHMARK_INDEX = 1_000;

/** How close the calibrated rate has to be known: its 95 % interval within ±5 % (#508, #523). */
const TOLERANCE = 0.05;
/** Unthrottled readings after one warm-up reading, which a cold first launch reads low. */
const UNTHROTTLED_READINGS = 3;
/** Throttled readings before the interval is first checked, and at most (#523). */
const MIN_READINGS = 9;
const MAX_READINGS = 60;

/** One throttled reading: the rate it was taken under and the benchmark index measured. */
interface Step {
  readonly rate: number;
  readonly benchmarkIndex: number;
}

/** The result of the calibration, attached to the report of each key page. */
export interface CpuCalibration {
  readonly targetBenchmarkIndex: number;
  readonly unthrottledReadings: readonly number[];
  readonly steps: readonly Step[];
  /** The 95 % interval of the calibrated rate when it was accepted. */
  readonly rateInterval: readonly [number, number];
  /** The `throttling.cpuSlowdownMultiplier` of the Lighthouse runs. */
  readonly cpuSlowdownMultiplier: number;
}

/** Measures the benchmark index under a CPU throttling rate (1 = unthrottled). */
export type MeasureBenchmark = (rate: number) => Promise<number>;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? Number.NaN)
    : ((sorted[middle - 1] ?? Number.NaN) + (sorted[middle] ?? Number.NaN)) / 2;
}

/**
 * The 95 % interval of the median of `values` from their order statistics (distribution-free): the
 * values of rank n/2 ∓ 0.98·√n.
 */
function medianInterval(values: readonly number[]): [number, number] {
  const sorted = [...values].sort((a, b) => a - b);
  const k = Math.max(0, Math.floor(sorted.length / 2 - 0.98 * Math.sqrt(sorted.length)));
  return [sorted[k] ?? Number.NaN, sorted[sorted.length - 1 - k] ?? Number.NaN];
}

const round = (value: number) => Number(value.toFixed(3));

/**
 * Calibrates the CPU slowdown so that the runner emulates the device of
 * {@link TARGET_BENCHMARK_INDEX}. A fixed multiplier would emulate a slower device on a slower
 * runner: with 4× the TBT of one build fell into bands by the CPU class of GitHub's runners (#508).
 *
 * One benchmark reading spreads by about 11 % on a busy runner, and more under throttling, so a
 * single reading cannot place the rate within 5 % (#523). Every throttled reading at rate r
 * estimates the rate of the target as r · index / target; the next reading is taken at the median
 * of all estimates so far, and the calibration ends once the 95 % interval of that median lies
 * within ±5 % of it – the pooled median that the WebPageTest agent and Jetpack use against noise,
 * with a stop rule instead of a fixed count. Throws when the runner is slower than the target or
 * too noisy to reach that interval in {@link MAX_READINGS} readings, and never falls back to a
 * fixed multiplier.
 */
export async function calibrate(measure: MeasureBenchmark): Promise<CpuCalibration> {
  // The unthrottled index only gives the first rate and tells a runner slower than the target;
  // its median, not the agreement of two readings, which the noise of #523 broke as well.
  await measure(1);
  const unthrottledReadings: number[] = [];
  for (let reading = 1; reading <= UNTHROTTLED_READINGS; reading++) {
    unthrottledReadings.push(await measure(1));
  }
  const unthrottled = median(unthrottledReadings);
  if (unthrottled < TARGET_BENCHMARK_INDEX) {
    throw new Error(
      `The runner (benchmark index ${String(unthrottled)}) is slower than the emulated device ` +
        `(${String(TARGET_BENCHMARK_INDEX)}).`,
    );
  }

  const steps: Step[] = [];
  const estimates: number[] = [];
  let rate = unthrottled / TARGET_BENCHMARK_INDEX;
  let interval: [number, number] = [Number.NaN, Number.NaN];
  for (let reading = 1; reading <= MAX_READINGS; reading++) {
    const benchmarkIndex = await measure(rate);
    steps.push({ rate: round(rate), benchmarkIndex });
    estimates.push((rate * benchmarkIndex) / TARGET_BENCHMARK_INDEX);
    rate = Math.max(1, median(estimates));
    if (reading < MIN_READINGS) continue;
    interval = medianInterval(estimates);
    if (interval[0] >= rate * (1 - TOLERANCE) && interval[1] <= rate * (1 + TOLERANCE)) {
      return {
        targetBenchmarkIndex: TARGET_BENCHMARK_INDEX,
        unthrottledReadings,
        steps,
        rateInterval: [round(interval[0]), round(interval[1])],
        cpuSlowdownMultiplier: round(rate),
      };
    }
  }
  throw new Error(
    `The runner is too noisy to calibrate the CPU slowdown: after ${String(MAX_READINGS)} ` +
      `readings the 95 % interval of the rate is ${String(round(interval[0]))}–` +
      `${String(round(interval[1]))} around ${String(round(rate))}, wider than ` +
      `±${String(TOLERANCE * 100)} %. Readings: ${JSON.stringify(steps)}.`,
  );
}

const BENCHMARK = `(${pageFunctions.computeBenchmarkIndex.toString()})()`;

async function benchmark(page: Page, cdp: CDPSession, rate: number): Promise<number> {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  return Math.round(await page.evaluate<number>(BENCHMARK));
}

/** {@link calibrate} in a page of the Chromium that Lighthouse drives. */
export async function calibrateCpuSlowdown(context: BrowserContext): Promise<CpuCalibration> {
  const page = await context.newPage();
  try {
    const cdp = await context.newCDPSession(page);
    const calibration = await calibrate((rate) => benchmark(page, cdp, rate));
    // Lighthouse applies the multiplier itself.
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    return calibration;
  } finally {
    await page.close();
  }
}
