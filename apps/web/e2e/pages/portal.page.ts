import type { Locator, Page } from '@playwright/test';

/** The views of the end-user portal (§5.7). */
export class PortalPage {
  readonly heading: Locator;
  readonly createTicket: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly submit: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.createTicket = page.getByRole('link', { name: 'Create ticket' });
    this.title = page.getByRole('textbox', { name: 'Title' });
    this.description = page.getByRole('textbox', { name: 'Description' });
    this.submit = page.getByRole('button', { name: 'Submit' });
  }

  /** A ticket of "My tickets" by its title. */
  ticket(title: string): Locator {
    return this.page.getByRole('link').filter({ hasText: title });
  }

  /** A group of "My tickets" by its heading. */
  group(name: 'Awaiting your reply' | 'Other tickets'): Locator {
    return this.page.getByRole('region', { name });
  }

  /** The items of the history of a ticket (§4.5). */
  get history(): Locator {
    return this.page.getByRole('region', { name: 'History' }).getByRole('listitem');
  }
}
