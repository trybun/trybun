import { expect, type Locator, type TestInfo } from '@playwright/test';

/** The minimum size of a touch target (§2.9); compact sizes only on desktop (§18.6). */
export function minimumTargetSize(testInfo: TestInfo): number {
  return testInfo.project.name === 'desktop' ? 32 : 44;
}

/**
 * Checks the size of a touch target, measured until it is stable. The menus of the header load
 * after the first paint (#72) and the help results render again after hydration, so the element
 * found by one call can be replaced before the next: a single `boundingBox()` then returns `null`.
 */
export async function expectTouchTarget(
  target: Locator,
  minimum: number,
  dimensions: readonly ('height' | 'width')[] = ['height'],
): Promise<void> {
  for (const dimension of dimensions) {
    await expect
      .poll(async () => (await target.boundingBox())?.[dimension] ?? 0, {
        message: `${dimension} of ${target.toString()}`,
      })
      .toBeGreaterThanOrEqual(minimum);
  }
}
