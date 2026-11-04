import type { Locator, Page } from '@playwright/test';

/** The acceptance page of an invitation link (ADR 0009). */
export class InvitationPage {
  readonly heading: Locator;
  readonly email: Locator;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly password: Locator;
  readonly accept: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.email = page.getByLabel('E-mail address');
    this.firstName = page.getByLabel('First name');
    this.lastName = page.getByLabel('Last name');
    this.password = page.getByLabel('Password', { exact: true });
    this.accept = page.getByRole('button', { name: 'Accept and sign in' });
  }

  /**
   * Opens a link of the API, whose origin is the public domain of the installation: the path and
   * the fragment with the token are the same on the web application under test.
   */
  goto(link: string): Promise<unknown> {
    const url = new URL(link);
    return this.page.goto(`${url.pathname}${url.hash}`);
  }

  /** Accepts as an end user with a password (AQ1). */
  async acceptWithPassword(firstName: string, lastName: string, password: string): Promise<void> {
    await this.firstName.fill(firstName);
    await this.lastName.fill(lastName);
    await this.password.fill(password);
    await this.accept.click();
  }
}
