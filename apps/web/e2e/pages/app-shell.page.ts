import type { Locator, Page } from '@playwright/test';

/** The application shell around the team views (§2.9). */
export class AppShellPage {
  readonly header: Locator;
  readonly navigation: Locator;
  readonly accountMenu: Locator;
  readonly help: Locator;
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.header = page.getByRole('banner');
    // Only one of the side and the bottom navigation is shown for a viewport.
    this.navigation = page.getByRole('navigation', { name: 'Main navigation' });
    this.accountMenu = page.getByRole('button', { name: 'Account menu' });
    this.help = page.getByRole('banner').getByRole('link', { name: 'Help' });
    this.heading = page.getByRole('heading', { level: 1 });
  }

  goto(): Promise<unknown> {
    return this.page.goto('/');
  }

  /** The widest element overflow of the page: the horizontal scroll a user would see. */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }

  async openAccountMenu(): Promise<Locator> {
    await this.accountMenu.click();
    return this.page.getByRole('menu');
  }
}
