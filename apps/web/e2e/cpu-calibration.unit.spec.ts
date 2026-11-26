import { describe, expect, it } from 'vitest';
import { TARGET_BENCHMARK_INDEX, calibrate } from './cpu-calibration.js';

/**
 * A runner whose benchmark index under rate r is `unthrottled · 0.85 / r^1.05` – throttled
 * readings come out about 15 % below unthrottled / r, as measured locally (#523) – with lognormal
 * noise of `sigma`, drawn from a seeded generator so every run reads the same values.
 */
function runner(unthrottled: number, sigma: number, seed: number) {
  let state = seed;
  const random = () => (state = (state * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  const gauss = () =>
    Math.sqrt(-2 * Math.log(random() || 1e-12)) * Math.cos(2 * Math.PI * random());
  const truth = (rate: number) => (rate === 1 ? unthrottled : (unthrottled * 0.85) / rate ** 1.05);
  let readings = 0;
  const measure = (rate: number) => {
    readings++;
    return Promise.resolve(Math.round(truth(rate) * Math.exp(sigma * gauss())));
  };
  return { measure, truth, readings: () => readings };
}

/** How far the true index of the calibrated rate is from the target. */
const error = (truth: (rate: number) => number, rate: number) =>
  Math.abs(truth(rate) / TARGET_BENCHMARK_INDEX - 1);

describe('calibrate (#523)', () => {
  it('finds the rate of the target within 5 % on a quiet runner, in few readings', async () => {
    const quiet = runner(3_000, 0.03, 1);

    const calibration = await calibrate(quiet.measure);

    expect(error(quiet.truth, calibration.cpuSlowdownMultiplier)).toBeLessThanOrEqual(0.05);
    expect(calibration.steps.length).toBeLessThanOrEqual(15);
    const [low, high] = calibration.rateInterval;
    expect(low).toBeLessThanOrEqual(calibration.cpuSlowdownMultiplier);
    expect(high).toBeGreaterThanOrEqual(calibration.cpuSlowdownMultiplier);
  });

  it('places the rate within 5 % on a runner as noisy as the one of #519, or fails', async () => {
    // The runner of #519 spread rate × index from 2254 to 3088, about 11 %: one reading per step
    // converged by chance, on a rate whose true index was off by up to 20 %.
    const trials = 200;
    let returned = 0;
    let within = 0;
    for (let seed = 1; seed <= trials; seed++) {
      const noisy = runner(2_400 + ((seed * 37) % 1_200), 0.11, seed);
      try {
        const { cpuSlowdownMultiplier } = await calibrate(noisy.measure);
        returned++;
        if (error(noisy.truth, cpuSlowdownMultiplier) <= 0.05) within++;
      } catch (thrown) {
        expect(String(thrown)).toContain('too noisy');
      }
    }

    expect(returned / trials).toBeGreaterThanOrEqual(0.85);
    expect(within / returned).toBeGreaterThanOrEqual(0.9);
  });

  it('fails with the interval and the readings on a runner too noisy to calibrate', async () => {
    const saturated = runner(3_000, 0.4, 7);

    await expect(calibrate(saturated.measure)).rejects.toThrow(
      /too noisy to calibrate the CPU slowdown: after 60 readings the 95 % interval .* Readings: \[/,
    );
    expect(saturated.readings()).toBe(1 + 3 + 60);
  });

  it('fails on a runner slower than the emulated device', async () => {
    await expect(calibrate(runner(900, 0, 3).measure)).rejects.toThrow(
      'The runner (benchmark index 900) is slower than the emulated device (1000).',
    );
  });

  it('ignores the cold first reading and takes the median of the unthrottled ones', async () => {
    // A cold first launch reads low; one more low reading would not move the median.
    const unthrottled = [400, 2_000, 900, 2_100];
    let next = 0;
    const measure = (rate: number) =>
      Promise.resolve(rate === 1 ? (unthrottled[next++] ?? 0) : Math.round(2_000 / rate));

    const calibration = await calibrate(measure);

    expect(calibration.unthrottledReadings).toEqual([2_000, 900, 2_100]);
    expect(calibration.cpuSlowdownMultiplier).toBe(2);
  });
});
