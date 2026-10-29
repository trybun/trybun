import { expect, type Page } from '@playwright/test';
import { SEEDED_OTP_SECRET, totp, TOTP_PERIOD_MS } from '../totp.js';

/** The Keycloak login screen the sign-in redirect leads to (§14.4). */
export class SignInPage {
  constructor(private readonly page: Page) {}

  /** Signs in with a seeded team account: password, then the one-time code (§7.4). */
  async signIn(email: string, password = 'trybun'): Promise<void> {
    await this.page.getByLabel('Username or email').fill(email);
    await this.page.getByLabel('Password', { exact: true }).fill(password);
    await this.page.getByRole('button', { name: 'Sign In' }).click();
    await this.enterOneTimeCode();
  }

  /**
   * Keycloak accepts a one-time code only once, so a sign-in right after the previous one (a
   * repeated local run) waits for the next code.
   */
  private async enterOneTimeCode(): Promise<void> {
    const rejection = this.page.getByText('Invalid authenticator code.');
    // The application shell after the sign-in, in the language of the account (§13.1).
    const signedIn = this.page.getByRole('button', { name: /^(Account menu|Menu konta)$/ });
    await this.submitCode();
    await expect(signedIn.or(rejection)).toBeVisible();
    if (await rejection.isVisible()) {
      await this.page.waitForTimeout(TOTP_PERIOD_MS - (Date.now() % TOTP_PERIOD_MS));
      await this.submitCode();
    }
  }

  private async submitCode(): Promise<void> {
    await this.page.getByLabel('One-time code').fill(totp(SEEDED_OTP_SECRET));
    await this.page.getByRole('button', { name: 'Sign In' }).click();
  }
}
