import { expect, type Page, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';

// The accessibility check itself (#502): axe measures the page once its animations have finished.
// A page of its own, so the check does not depend on which element of the application animates.

/** A dark button that fades in from half opacity over five seconds, as `Button` does after `disabled`. */
const FADING_BUTTON = `<!doctype html>
<html lang="en">
  <head><title>Fading button</title></head>
  <body style="background: #ffffff">
    <main>
      <button id="submit" style="color: #ffffff; background: #141a2e; opacity: 0.5; transition: opacity 5s">
        Submit
      </button>
    </main>
  </body>
</html>`;

/** Re-enables the button: the fade back to full opacity runs while the check starts. */
async function fadeIn(page: Page): Promise<void> {
  const fade = await page.locator('#submit').evaluate((button: HTMLElement) => {
    // Reading the computed style first makes the change a transition rather than a new start value.
    const from = getComputedStyle(button).opacity;
    button.style.opacity = '1';
    return { from, running: button.getAnimations().length };
  });
  // The check below is only meaningful while the transition runs.
  expect(fade).toEqual({ from: '0.5', running: 1 });
}

test.describe('the accessibility check', () => {
  test('measures an element after its transition has finished (#502)', async ({ page }) => {
    await page.setContent(FADING_BUTTON);
    // Re-enabling the button starts the fade back to full opacity.
    await fadeIn(page);

    expect(await seriousViolations(page)).toEqual([]);
  });

  test('still reports a contrast that stays too low', async ({ page }) => {
    await page.setContent(FADING_BUTTON.replace('color: #ffffff', 'color: #3a3f52'));
    await fadeIn(page);

    expect(await seriousViolations(page)).toEqual(['color-contrast: #submit']);
  });
});
