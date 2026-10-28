import type { Locator, Page } from '@playwright/test';

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

  /** The Undo button of the toast with a text. */
  undo(text: string): Locator {
    return this.page
      .locator('[data-slot="toast"]')
      .filter({ hasText: text })
      .getByRole('button', { name: 'Undo' });
  }

  /** Creates an organization in the New organization dialog. */
  async create(name: string, domains = ''): Promise<void> {
    await this.newOrganization.click();
    const dialog = this.page.getByRole('dialog', { name: 'New organization' });
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
