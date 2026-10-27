import type { Locator, Page } from '@playwright/test';

/** The Projects page and the settings of a project (§3.1, §7.3, §7.4). */
export class ProjectsPage {
  readonly heading: Locator;
  readonly stateTabs: Locator;
  readonly projects: Locator;
  readonly newProject: Locator;
  readonly settingsTabs: Locator;
  readonly archivedBanner: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.stateTabs = page.getByRole('tablist', { name: 'Project state' });
    this.projects = page.getByRole('main').getByRole('listitem');
    this.newProject = page.getByRole('button', { name: 'New project' });
    this.settingsTabs = page.getByRole('tablist', { name: 'Project settings' });
    this.archivedBanner = page.getByRole('status').filter({
      hasText: 'This project is archived and read-only.',
    });
  }

  goto(): Promise<unknown> {
    return this.page.goto('/projects');
  }

  project(name: string): Locator {
    return this.page.getByRole('link', { name: new RegExp(name) });
  }

  settingsTab(name: 'General' | 'Members' | 'Danger zone'): Locator {
    return this.settingsTabs.getByRole('tab', { name });
  }

  /** Creates a project in the New project dialog. */
  async create(name: string, key: string): Promise<void> {
    await this.newProject.click();
    const dialog = this.page.getByRole('dialog', { name: 'New project' });
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Key').fill(key);
    await dialog.getByRole('button', { name: 'Create project' }).click();
  }

  /** Adds a team member found by the search of the Add member dialog. */
  async addMember(search: string, name: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Add member' }).click();
    const dialog = this.page.getByRole('dialog', { name: 'Add member' });
    await dialog.getByLabel('Search by name or GitHub login').fill(search);
    await dialog.getByRole('radio', { name: new RegExp(name) }).check();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  }
}
