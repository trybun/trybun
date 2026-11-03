import { expect, type Locator, type Page } from '@playwright/test';

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
    this.help = page.getByRole('banner').getByRole('button', { name: 'Help' });
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

  /** Opens the help menu (§2.3, §2.4). */
  openHelpMenu(): Promise<Locator> {
    return this.openMenu(this.help);
  }

  /** Opens the account menu (§7.4). */
  openAccountMenu(): Promise<Locator> {
    return this.openMenu(this.accountMenu);
  }

  /**
   * Opens a header menu and returns it once its opening animation has finished.
   *
   * The server renders the button and the menu loads after the first paint (#72); a click before
   * the hydration opens nothing (WebKit, #191, #206), so the click repeats until the menu shows.
   * During the fade-in the text is semi-transparent, and axe would measure a colour contrast
   * nobody sees (#72).
   */
  private async openMenu(trigger: Locator): Promise<Locator> {
    const menu = this.page.getByRole('menu');
    await expect(async () => {
      if (!(await menu.isVisible())) {
        await trigger.click();
      }
      await expect(menu).toBeVisible({ timeout: 1000 });
    }).toPass();
    await menu.evaluate((popup) =>
      Promise.all(popup.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
    return menu;
  }
}
