import { expect, type Locator, type TestInfo } from '@playwright/test';

/** The readable width of a form, settings or detail page: `max-w-3xl` (§2.9). */
const READABLE_WIDTH = 768;

/**
 * Checks that a list uses the full width of the content area (§2.9). Only the desktop viewport
 * shows the difference: below 1280 px the content area is narrower than the readable width.
 */
export async function expectFullContentWidth(list: Locator, testInfo: TestInfo): Promise<void> {
  if (testInfo.project.name !== 'desktop') {
    return;
  }
  const box = await list.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(READABLE_WIDTH);
}
