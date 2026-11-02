import { expect, type Page } from '@playwright/test';

/**
 * Waits until the toasts are gone. They lie above the page and the dialogs (#172) – over the
 * Danger zone of an organization on a desktop, over the actions of a bottom sheet on a phone – and
 * take the click meant for the buttons below; a pointer over them pauses their timers, so it moves
 * away first.
 */
export async function waitForToastsToClose(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-slot="toast"]')).toHaveCount(0, { timeout: 15_000 });
}
