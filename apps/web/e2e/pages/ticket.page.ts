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

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.copyIdentifier = page.getByRole('button', { name: /^Copy identifier / });
    this.details = page.getByRole('region', { name: 'Details' });
    this.description = page.getByRole('region', { name: 'Description' });
    this.activity = page.getByRole('region', { name: 'Activity' });
    this.hideEvents = this.activity.getByRole('switch', { name: 'Hide events' });
    this.eventsHidden = this.activity.getByText('Events are hidden. Comments appear here.');
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
