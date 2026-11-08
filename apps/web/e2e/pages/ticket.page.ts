import { expect, type Locator, type Page } from '@playwright/test';

/** The team ticket view (§3.2, §4.5). */
export class TicketPage {
  readonly heading: Locator;
  readonly copyIdentifier: Locator;
  readonly details: Locator;
  readonly description: Locator;
  readonly activity: Locator;
  readonly hideEvents: Locator;
  readonly eventsHidden: Locator;
  readonly assignToMe: Locator;
  readonly unassignMe: Locator;
  /** The assignee picker: a combobox from the tablet breakpoint, a sheet's button on phones. */
  readonly assigneePicker: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.copyIdentifier = page.getByRole('button', { name: /^Copy identifier / });
    this.details = page.getByRole('region', { name: 'Details' });
    this.description = page.getByRole('region', { name: 'Description' });
    this.activity = page.getByRole('region', { name: 'Activity' });
    this.hideEvents = this.activity.getByRole('switch', { name: 'Hide events' });
    this.eventsHidden = this.activity.getByText('Events are hidden. Comments appear here.');
    this.assignToMe = this.details.getByRole('button', { name: 'Assign to me' });
    this.unassignMe = this.details.getByRole('button', { name: 'Unassign me' });
    this.assigneePicker = this.details
      .getByRole('combobox', { name: 'Assignee' })
      .or(this.details.getByRole('button', { name: /^Assignee: / }));
  }

  /** A toast with `text`. */
  toast(text: string): Locator {
    return this.page.locator('[data-slot="toast"]').filter({ hasText: text });
  }

  /**
   * Assigns `name` with the picker – from the list of the combobox, or from the bottom sheet on
   * phones – and waits until the ticket is saved. The server-rendered picker does nothing before
   * the hydration, so opening it is repeated until its choices show.
   */
  async assign(name: string): Promise<void> {
    const choice = this.page
      .getByRole('option', { name, exact: true })
      .or(this.page.getByRole('dialog', { name: 'Assignee' }).getByRole('radio', { name }));
    await expect(async () => {
      await this.assigneePicker.click();
      await expect(choice).toBeVisible({ timeout: 2_000 });
    }).toPass();
    const saved = this.page.waitForResponse(
      (response) =>
        /^\/api\/v1\/tickets\/[^/]+$/.test(new URL(response.url()).pathname) &&
        response.request().method() === 'PATCH',
    );
    await choice.click();
    expect((await saved).status()).toBe(200);
  }

  goto(identifier: string) {
    return this.page.goto(`/tickets/${identifier}`);
  }

  /** The items of the timeline: the opening item and the events, oldest first. */
  get timelineItems(): Locator {
    return this.activity.getByRole('listitem');
  }

  /**
   * Turns **Hide events** on or off and waits until the account stores it. The server-rendered
   * switch does nothing before the hydration, so the press is repeated until it changes.
   */
  async setEventsHidden(hidden: boolean): Promise<void> {
    await expect(this.hideEvents).toBeVisible();
    if ((await this.hideEvents.getAttribute('aria-checked')) === String(hidden)) {
      return;
    }
    const saved = this.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/users/me' &&
        response.request().method() === 'PATCH',
    );
    await expect(async () => {
      await this.hideEvents.click();
      await expect(this.hideEvents).toHaveAttribute('aria-checked', String(hidden), {
        timeout: 2_000,
      });
    }).toPass();
    expect((await saved).status()).toBe(200);
  }
}
