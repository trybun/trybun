import type { Locator, Page } from '@playwright/test';

/** The help viewer (§2.3): the help index with its search, and the help pages. */
export class HelpPage {
  readonly heading: Locator;
  readonly search: Locator;
  readonly results: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.search = page.getByRole('searchbox');
    this.results = page.getByRole('main').getByRole('link');
  }

  goto(): Promise<unknown> {
    return this.page.goto('/help');
  }
}
