import { expect, type Locator, type Page } from '@playwright/test';

/** The Accounts page of the Administrator panel (§7.4). */
export class AccountsPage {
  readonly heading: Locator;
  readonly search: Locator;
  readonly kindFilter: Locator;
  readonly stateFilter: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 2, name: 'Accounts' });
    this.search = page.getByRole('searchbox', { name: 'Search' });
    this.kindFilter = page.getByRole('combobox', { name: 'Kind' });
    this.stateFilter = page.getByRole('combobox', { name: 'State' });
  }

  goto(query = ''): Promise<unknown> {
    return this.page.goto(`/admin/accounts${query}`);
  }

  /**
   * The visible entries of the listed accounts: the cards on phones, the rows of the table from the
   * tablet on (Rule 9); the other layout is hidden. Only the entries themselves – not the items of
   * a card's pending invitations nor the invitation rows below an account's row, which name the
   * inviting person ("Invited by Ada Admin").
   */
  get entries(): Locator {
    const cards = this.page
      .getByRole('list', { name: 'Accounts', exact: true })
      .locator(':scope > li');
    const rows = this.page
      .getByRole('table', { name: 'Accounts', exact: true })
      .getByRole('row')
      .filter({ has: this.page.getByRole('rowheader') });
    return cards.or(rows).filter({ visible: true });
  }

  /** The visible entry of an account. */
  account(name: string): Locator {
    return this.entries.filter({ hasText: name });
  }

  actionsOf(name: string): Locator {
    return this.page
      .getByRole('button', { name: `Actions for ${name}`, exact: true })
      .filter({ visible: true });
  }

  /** Chooses an action of an account in its menu. */
  async act(name: string, action: string): Promise<void> {
    await this.actionsOf(name).click();
    await this.page.getByRole('menuitem', { name: action }).click();
  }

  /** Searches until only the account with the name is listed. */
  async find(name: string): Promise<void> {
    // A search typed before the page hydrated is lost (WebKit is slower), so type until the list
    // shows its results. The search matches a part of the name or the address, so a single entry
    // is the account itself.
    await expect(async () => {
      await this.search.fill('');
      await this.search.fill(name);
      await expect(this.entries).toHaveCount(1, { timeout: 2_000 });
    }).toPass();
    await expect(this.account(name)).toHaveCount(1);
  }

  /** Opens Invite of the page header; the dialog of an account's own Invite is the same. */
  async openInvite(): Promise<Locator> {
    const dialog = this.page.getByRole('dialog', { name: 'Invite' });
    // The server renders the button; a click before the hydration opens nothing.
    await expect(async () => {
      await this.page.getByRole('button', { name: 'Invite', exact: true }).click();
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass();
    return dialog;
  }

  /** The visible pending invitations of an account, named by its address. */
  invitationsOf(email: string): Locator {
    return this.page
      .getByRole('list', { name: `Pending invitations of ${email}` })
      .filter({ visible: true });
  }

  toast(text: string): Locator {
    return this.page.locator('[data-slot="toast"]').filter({ hasText: text });
  }
}
