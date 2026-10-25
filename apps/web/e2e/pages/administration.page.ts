import type { Locator, Page } from '@playwright/test';

/** The Administrator panel (§15.6): the getting-started checklist and the "About" page. */
export class AdministrationPage {
  readonly heading: Locator;
  readonly sections: Locator;
  readonly checklistItems: Locator;
  readonly installedVersion: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.sections = page.getByRole('navigation', { name: 'Sections of the Administrator panel' });
    this.checklistItems = page
      .getByRole('region', { name: 'Getting started' })
      .getByRole('listitem');
    this.installedVersion = page.getByTestId('installed-version');
  }

  goto(path: '/admin' | '/admin/about' = '/admin'): Promise<unknown> {
    return this.page.goto(path);
  }
}
