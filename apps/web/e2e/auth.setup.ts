import { expect, test as setup } from '@playwright/test';
import { SignInPage } from './pages/sign-in.page.js';
import { TEAM_STORAGE_STATE } from './storage-state.js';

// One sign-in for all projects: Keycloak accepts a one-time code only once.
setup('sign in as a team member', async ({ page }) => {
  await page.goto('/');
  await new SignInPage(page).signIn('developer@example.com');

  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  await page.context().storageState({ path: TEAM_STORAGE_STATE });
});
