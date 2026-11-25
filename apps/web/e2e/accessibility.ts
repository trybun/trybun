import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * The violations of the accessibility gate (§2.14): the WCAG 2.2 AA rule tags, impact `serious`
 * or `critical`. The focus guards of Base UI popups are excluded, as in Storybook. The page is
 * measured once its animations have finished (#502).
 */
export async function seriousViolations(page: Page): Promise<string[]> {
  await animationsFinished(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .exclude('[data-base-ui-focus-guard]')
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`,
    );
}

/**
 * Waits until the finite CSS transitions and animations of the page have finished. axe measures
 * the colours an element has at that moment: a `Button` fading back from `disabled:opacity-50`, or
 * a popup fading in, fails `color-contrast` although its settled state passes (#72, #502). Infinite
 * animations, such as spinners, never finish and are not waited for; an animation that starts
 * while the others finish is waited for too.
 *
 * Each check follows a rendering update of the page. WebKit reports an animation as finished while
 * the computed style still holds an early frame of it until the next rendering update: a dialog
 * read `opacity: 0.02` after its fade-in had finished, for up to ~0.5 s on a slow runner (#514).
 */
async function animationsFinished(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // The second callback runs after the rendering update the first one preceded.
    const renderingUpdated = () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
    for (;;) {
      await renderingUpdated();
      const running = document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === 'running' &&
            animation.effect?.getComputedTiming().iterations !== Infinity,
        );
      if (running.length === 0) {
        return;
      }
      // A cancelled animation rejects `finished`; it no longer changes the page either.
      await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
    }
  });
}
