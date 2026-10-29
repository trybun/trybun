import { execFileSync } from 'node:child_process';
import { expect, type Page, test as setup } from '@playwright/test';
import { SignInPage } from './pages/sign-in.page.js';
import {
  ADMIN_STORAGE_STATE,
  NEWCOMER_STORAGE_STATE,
  TEAM_STORAGE_STATE,
} from './storage-state.js';

/**
 * The sign-in sets the language of the account (§13.1), Polish for the demo accounts; the tests
 * read the texts in the language of the browser, so the stored state keeps no language cookie.
 */
async function useLanguageOfBrowser(page: Page): Promise<void> {
  await page.context().clearCookies({ name: 'NEXT_LOCALE' });
  await page.reload();
}

// One sign-in per account for all projects. Keycloak accepts a one-time code only once, and the
// seeded accounts share one TOTP secret: the second sign-in may wait for the next code.
setup.describe.configure({ mode: 'serial', timeout: 90_000 });

setup('sign in as a team member', async ({ page }) => {
  await page.goto('/');
  await new SignInPage(page).signIn('developer@example.com');
  await useLanguageOfBrowser(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  await page.context().storageState({ path: TEAM_STORAGE_STATE });
});

setup('sign in as the newcomer without tour progress', async ({ page }) => {
  // The demo dataset restores the tour progress (§15.12): the newcomer has none on every run.
  execFileSync('pnpm', ['--filter', '@trybun/server', 'db:seed'], { stdio: 'inherit' });
  await page.goto('/');
  await new SignInPage(page).signIn('newcomer@example.com');
  await useLanguageOfBrowser(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  await page.context().storageState({ path: NEWCOMER_STORAGE_STATE });
});

setup('sign in as the Administrator', async ({ page }) => {
  await page.goto('/');
  await new SignInPage(page).signIn('admin@example.com');
  await useLanguageOfBrowser(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
