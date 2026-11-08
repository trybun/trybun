import { expect, type Locator, type Page } from '@playwright/test';

/** A file chosen in the browser's file dialog. */
export interface ChosenFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** The views of the end-user portal (§5.7). */
export class PortalPage {
  readonly heading: Locator;
  readonly createTicket: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly submit: Locator;
  readonly attachFiles: Locator;
  /** The files added to the form, below the editor (S1-08). */
  readonly drafts: Locator;
  /** The attachments of a ticket. */
  readonly attachments: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.createTicket = page.getByRole('link', { name: 'Create ticket' });
    this.title = page.getByRole('textbox', { name: 'Title' });
    this.description = page.getByRole('textbox', { name: 'Description' });
    this.submit = page.getByRole('button', { name: 'Submit' });
    this.attachFiles = page.getByRole('button', { name: 'Attach files' });
    this.drafts = page.getByRole('list', { name: 'Files to attach' });
    this.attachments = page.getByRole('region', { name: 'Attachments' });
  }

  /**
   * Adds files with **Attach files** of the editor. The editor loads after the first paint, and a
   * press before its hydration opens no file dialog: the press is repeated until one opens.
   */
  async addFiles(files: ChosenFile[]): Promise<void> {
    await expect(async () => {
      const chooser = this.page.waitForEvent('filechooser', { timeout: 2_000 });
      await this.attachFiles.click();
      await (await chooser).setFiles(files);
    }).toPass();
  }

  /**
   * Deletes an attachment of the ticket after the confirmation; the server-rendered **Delete**
   * opens nothing before the hydration, so the press is repeated until the dialog shows.
   */
  async deleteAttachment(fileName: string): Promise<void> {
    const dialog = this.page.getByRole('dialog', { name: `Delete ${fileName}?` });
    await expect(async () => {
      await this.attachments.getByRole('button', { name: `Delete ${fileName}` }).click();
      await expect(dialog).toBeVisible({ timeout: 2_000 });
    }).toPass();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
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
