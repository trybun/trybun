import type { Locator, Page } from '@playwright/test';

/** The tip of a running product tour (§2.4): a popover next to its target, a sheet on phones. */
export class ProductTourPage {
  readonly tip: Locator;
  readonly next: Locator;
  readonly done: Locator;

  constructor(private readonly page: Page) {
    // The title of a step starts with its counter: "Step 2 of 4 Main navigation".
    this.tip = page.getByRole('dialog', { name: /^Step \d+ of \d+/ });
    this.next = this.tip.getByRole('button', { name: 'Next' });
    this.done = this.tip.getByRole('button', { name: 'Done' });
  }

  step(step: number, count: number): Locator {
    return this.page.getByRole('dialog', { name: new RegExp(`^Step ${step} of ${count}`) });
  }

  /** The visible element of a `data-tour` target; only tours use these attributes (§18.7). */
  target(target: string): Locator {
    return this.page.locator(`[data-tour="${target}"]`).filter({ visible: true });
  }

  highlighted(): Locator {
    return this.page.locator('[data-tour-highlighted]');
  }
}
