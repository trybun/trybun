import { expect, type Locator, type Page } from '@playwright/test';
import { waitForToastsToClose } from '../toasts.js';

/** The Organizations page of the Administrator panel and the detail of an organization (§7.3). */
export class OrganizationsPage {
  readonly heading: Locator;
  readonly stateTabs: Locator;
  readonly newOrganization: Locator;
  readonly archivedBanner: Locator;
  readonly domainField: Locator;
  readonly emailField: Locator;
  readonly domains: Locator;
  readonly members: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 2 }).first();
    this.stateTabs = page.getByRole('tablist', { name: 'Organization state' });
    this.newOrganization = page.getByRole('button', { name: 'New organization' });
    this.archivedBanner = page.getByRole('status').filter({
      hasText: 'This organization is archived',
    });
    this.domainField = page.getByLabel('Domain', { exact: true });
    this.emailField = page.getByLabel('E-mail address');
    this.domains = page.getByRole('region', { name: 'E-mail domains' });
    this.members = page.getByRole('region', { name: 'Members' }).getByRole('listitem');
  }

  goto(): Promise<unknown> {
    return this.page.goto('/admin/organizations');
  }

  organization(name: string): Locator {
    return this.page.getByRole('link', { name: new RegExp(name) });
  }

  /**
   * Opens the detail of an organization from the list. The server renders the links of the list,
   * and a click while the list still hydrates navigates nowhere – on the tablet (WebKit) the page
   * stayed on the list and fetched no detail (#289, like #241) – so the click repeats until the
   * detail route shows. The cause was the New organization button vanishing during the hydration,
   * which moved the list between pointerdown and pointerup (#308, fixed); the repetition stays until
   * CI confirms the fix.
   */
  async openOrganization(name: string): Promise<void> {
    const detail = /\/admin\/organizations\/[\da-f-]+$/;
    await expect(async () => {
      if (!detail.test(this.page.url())) {
        await this.organization(name).click({ timeout: 1000 });
      }
      await expect(this.page).toHaveURL(detail, { timeout: 1000 });
    }).toPass();
  }

  /** Waits until the toasts over the Danger zone are gone (`waitForToastsToClose`). */
  waitForToastsToClose(): Promise<void> {
    return waitForToastsToClose(this.page);
  }

  /** The Undo button of the toast with a text. */
  undo(text: string): Locator {
    return this.page
      .locator('[data-slot="toast"]')
      .filter({ hasText: text })
      .getByRole('button', { name: 'Undo' });
  }

  /**
   * Opens the New organization dialog. The server renders the button and the dialog loads after
   * the first paint; a click before the hydration opens nothing (WebKit, #238), so the click
   * repeats until the dialog shows.
   */
  async openNewOrganization(): Promise<Locator> {
    const dialog = this.page.getByRole('dialog', { name: 'New organization' });
    await expect(async () => {
      if (!(await dialog.isVisible())) {
        await this.newOrganization.click();
      }
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass();
    return dialog;
  }

  /** Creates an organization in the New organization dialog. */
  async create(name: string, domains = ''): Promise<void> {
    const dialog = await this.openNewOrganization();
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('E-mail domains (optional)').fill(domains);
    await dialog.getByRole('button', { name: 'Create organization' }).click();
  }

  async addDomain(domain: string): Promise<void> {
    await this.domainField.fill(domain);
    await this.page.getByRole('button', { name: 'Add domain' }).click();
  }

  async addMember(email: string): Promise<void> {
    await this.emailField.fill(email);
    await this.page.getByRole('button', { name: 'Add member' }).click();
  }
}
