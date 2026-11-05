import type { Locator, Page } from '@playwright/test';

/** The Account settings page (§13.1), in English or Polish. */
export class SettingsPage {
  readonly language: Locator;
  readonly timeZone: Locator;
  readonly save: Locator;

  constructor(private readonly page: Page) {
    this.language = page.getByRole('combobox', { name: /^(Language|Język)$/ });
    this.timeZone = page.getByRole('combobox', { name: /^(Time zone|Strefa czasowa)$/ });
    this.save = page.getByRole('button', { name: /^(Save|Zapisz)$/ });
  }

  goto(): Promise<unknown> {
    return this.page.goto('/settings');
  }

  heading(name: string): Locator {
    return this.page.getByRole('heading', { level: 1, name });
  }

  /** Chooses a language of the list. */
  async chooseLanguage(name: string): Promise<void> {
    await this.language.click();
    await this.page.getByRole('option', { name }).click();
  }

  /** Searches the time zones and chooses one. */
  async chooseTimeZone(timeZone: string): Promise<void> {
    await this.timeZone.fill(timeZone);
    await this.page.getByRole('option', { name: timeZone, exact: true }).click();
  }
}
