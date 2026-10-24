import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * The violations of the accessibility gate (§2.14): the WCAG 2.2 AA rule tags, impact `serious`
 * or `critical`. The focus guards of Base UI popups are excluded, as in Storybook.
 */
export async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .exclude('[data-base-ui-focus-guard]')
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`);
}
