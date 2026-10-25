import type { Locator, Page } from '@playwright/test';

/** The first-run wizard (§15.6). */
export class SetupPage {
  readonly heading: Locator;
  readonly message: Locator;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly showPassword: Locator;
  readonly submit: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.message = page.getByRole('heading', { level: 2 });
    this.firstName = page.getByLabel('First name');
    this.lastName = page.getByLabel('Last name');
    this.email = page.getByLabel('E-mail address');
    this.password = page.getByLabel('Password', { exact: true });
    this.showPassword = page.getByRole('button', { name: 'Show password' });
    this.submit = page.getByRole('button', { name: 'Create Administrator account' });
  }

  goto(token?: string): Promise<unknown> {
    return this.page.goto(token === undefined ? '/setup' : `/setup#token=${token}`);
  }
}
