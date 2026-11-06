import { expect, type Locator, type Page } from '@playwright/test';

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

  /**
   * Opens the New project dialog. The server renders the button and the dialog loads after the
   * first paint; a click before the hydration opens nothing (WebKit, #236), so the click repeats
   * until the dialog shows.
   */
  async openNewProject(): Promise<Locator> {
    const dialog = this.page.getByRole('dialog', { name: 'New project' });
    await expect(async () => {
      if (!(await dialog.isVisible())) {
        await this.newProject.click();
      }
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass();
    return dialog;
  }

  /** Creates a project in the New project dialog. */
  async create(name: string, key: string): Promise<void> {
    const dialog = await this.openNewProject();
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Key').fill(key);
    await dialog.getByRole('button', { name: 'Create project' }).click();
  }

  /**
   * Opens the Add member dialog of the Members tab. Like New project, the button is server-rendered
   * and its dialog loads after the first paint, so the click repeats until the dialog shows (#236).
   */
  async openAddMember(): Promise<Locator> {
    const dialog = this.page.getByRole('dialog', { name: 'Add member' });
    await expect(async () => {
      if (!(await dialog.isVisible())) {
        await this.page.getByRole('button', { name: 'Add member' }).click();
      }
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass();
    return dialog;
  }

  /**
   * Opens the Add member dialog with an e-mail address and a role, waiting for the preview of
   * what sending will do (§7.4).
   */
  async addByEmail(
    email: string,
    role: 'Developer' | 'Project manager' | 'End user',
  ): Promise<Locator> {
    const dialog = await this.openAddMember();
    await dialog.getByRole('radio', { name: 'By e-mail address' }).check();
    await dialog.getByRole('textbox', { name: 'E-mail address' }).fill(email);
    await dialog.getByRole('combobox', { name: 'Role' }).click();
    await this.page.getByRole('option', { name: role, exact: true }).click();
    return dialog;
  }

  /** Adds a team member found by the search of the Add member dialog. */
  async addMember(search: string, name: string): Promise<void> {
    const dialog = await this.openAddMember();
    await dialog.getByLabel('Search by name or GitHub login').fill(search);
    await dialog.getByRole('radio', { name: new RegExp(name) }).check();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  }
}
