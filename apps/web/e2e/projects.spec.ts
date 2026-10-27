import { expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { ProjectsPage } from './pages/projects.page.js';
import { ADMIN_STORAGE_STATE } from './storage-state.js';
import { expectTouchTarget, minimumTargetSize } from './touch-targets.js';

/** A key of the pattern of §3.1, unique for each test run and device. */
function uniqueKey(project: string): string {
  return `E${project[0]?.toUpperCase() ?? 'X'}${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

test.describe('projects of the Administrator', () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test('creates a project, adds a member, archives and unarchives it', async ({
    page,
  }, testInfo) => {
    const projects = new ProjectsPage(page);
    const key = uniqueKey(testInfo.project.name);
    const name = `E2E ${testInfo.project.name} ${key}`;
    await projects.goto();

    await projects.create(name, key);

    await expect(page).toHaveURL(/\/projects\/[\da-f-]+\/settings\?tab=members$/);
    await expect(projects.heading).toHaveText(name);
    await expect(projects.settingsTab('Members')).toHaveAttribute('aria-selected', 'true');
    await projects.addMember('Nina', 'Nina Newcomer');
    await expect(page.getByRole('main').getByText('Nina Newcomer')).toBeVisible();

    await projects.settingsTab('Danger zone').click();
    await page.getByRole('button', { name: 'Archive project' }).click();
    await expect(projects.archivedBanner).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();

    await page.getByRole('button', { name: 'Unarchive project' }).click();
    await expect(projects.archivedBanner).toBeHidden();
    await expect(page.getByRole('button', { name: 'Archive project' })).toBeVisible();
  });

  test('suggests the key from the name', async ({ page }) => {
    const projects = new ProjectsPage(page);
    await projects.goto();
    await projects.newProject.click();
    const dialog = page.getByRole('dialog', { name: 'New project' });

    // The initials of the words: `self-service` counts as two.
    await dialog.getByLabel('Name').fill('Customer self-service');

    await expect(dialog.getByLabel('Key')).toHaveValue('CSS');
  });

  test('passes axe, fits the viewport and has touch targets', async ({ page }, testInfo) => {
    const projects = new ProjectsPage(page);
    const shell = new AppShellPage(page);
    await projects.goto();
    await expect(projects.project('Customer portal')).toBeVisible();

    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    await expectTouchTarget(projects.project('Customer portal'), 44);
    await expectTouchTarget(
      projects.stateTabs.getByRole('tab', { name: 'Archived' }),
      minimumTargetSize(testInfo),
    );

    await projects.project('Customer portal').click();
    await expect(projects.settingsTabs).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    await expectTouchTarget(projects.settingsTab('Members'), minimumTargetSize(testInfo));
  });
});

test.describe('projects of a Developer', () => {
  test('lists the own projects and shows no action the Developer may not perform', async ({
    page,
  }) => {
    const projects = new ProjectsPage(page);
    await projects.goto();

    await expect(projects.heading).toHaveText('Projects');
    await expect(projects.newProject).toHaveCount(0);
    await expect(projects.project('Customer portal')).toContainText('Developer');
    await projects.stateTabs.getByRole('tab', { name: 'Archived' }).click();
    await expect(page).toHaveURL('/projects?state=archived');
    await expect(projects.project('Legacy intranet')).toBeVisible();

    await projects.goto();
    await projects.project('Customer portal').click();

    await expect(page.getByLabel('Name')).toHaveAttribute('readonly', '');
    await expect(page.getByRole('switch', { name: 'Resolution confirmation' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await expect(projects.settingsTab('Danger zone')).toHaveCount(0);
    await projects.settingsTab('Members').click();
    await expect(page.getByRole('main').getByText('Marek Manager')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add member' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Remove/ })).toHaveCount(0);
  });

  test('is reached from the navigation of every device', async ({ page }) => {
    const shell = new AppShellPage(page);
    await shell.goto();

    const links = page.getByRole('link', { name: 'Projects' });
    await links.filter({ visible: true }).first().click();

    await expect(page).toHaveURL('/projects');
  });
});
