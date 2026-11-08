import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The team templates of the catalogues (`tickets.templates`, §3.4) that the tests insert, in both
 * languages: the form inserts them in the account language, whatever the browser's (S1-10 Q4).
 */
export const TEMPLATES = {
  en: {
    bug: '## Problem\n\n## Steps to reproduce\n\n1.\n\n## Expected result\n\n## Actual result\n\n## Environment',
    task: '## Scope of work\n\n## Completion criteria\n\n- [ ]',
    question: '## Question\n\n## Context',
  },
  pl: {
    bug: '## Problem\n\n## Kroki do odtworzenia\n\n1.\n\n## Oczekiwany wynik\n\n## Faktyczny wynik\n\n## Środowisko',
    task: '## Zakres prac\n\n## Kryteria ukończenia\n\n- [ ]',
    question: '## Pytanie\n\n## Kontekst',
  },
} as const;

export type TemplateLanguage = keyof typeof TEMPLATES;

/** The full ticket form of the team at `/tickets/new` (§3.3). */
export class TicketFormPage {
  readonly heading: Locator;
  readonly project: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly priority: Locator;
  readonly assignToMe: Locator;
  readonly assigneePicker: Locator;
  readonly submit: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.project = page.getByRole('combobox', { name: 'Project' });
    this.title = page.getByRole('textbox', { name: 'Title' });
    this.description = page.getByRole('textbox', { name: 'Description' });
    this.priority = page.getByRole('combobox', { name: 'Priority' });
    this.assignToMe = page.getByRole('checkbox', { name: 'Assign to me' });
    this.assigneePicker = page
      .getByRole('combobox', { name: 'Assignee' })
      .or(page.getByRole('button', { name: /^Assignee: / }));
    this.submit = page.getByRole('button', { name: 'Create ticket' });
  }

  /** The choice of a type, e.g. "Bug". */
  type(name: string): Locator {
    return this.page.getByRole('radio', { name, exact: true });
  }

  goto(projectId?: string) {
    return this.page.goto(
      projectId === undefined ? '/tickets/new' : `/tickets/new?projectId=${projectId}`,
    );
  }

  /** The language of the template the form inserted: the task template of one of them. */
  async insertedLanguage(): Promise<TemplateLanguage> {
    await expect(this.description).toBeVisible();
    const value = await this.description.inputValue();
    const language = (Object.keys(TEMPLATES) as TemplateLanguage[]).find(
      (candidate) => TEMPLATES[candidate].task === value,
    );
    expect(language, `the task template, got ${JSON.stringify(value)}`).toBeDefined();
    return language!;
  }

  /**
   * Chooses a type. The server-rendered radios do nothing before the hydration, so the press is
   * repeated until the type is checked.
   */
  async chooseType(name: string): Promise<void> {
    await expect(async () => {
      await this.type(name).click();
      await expect(this.type(name)).toBeChecked({ timeout: 2_000 });
    }).toPass();
  }

  /**
   * Types a description. Text typed into the server-rendered editor before the hydration is
   * replaced by the form's value, so typing repeats until the description keeps it.
   */
  async fillDescription(text: string): Promise<void> {
    await expect(async () => {
      await this.description.fill(text);
      await expect(this.description).toHaveValue(text, { timeout: 2_000 });
    }).toPass();
  }

  /** Ticks **Assign to me**, repeated until the hydrated checkbox takes the press. */
  async checkAssignToMe(): Promise<void> {
    await expect(async () => {
      await this.assignToMe.click();
      await expect(this.assignToMe).toBeChecked({ timeout: 2_000 });
    }).toPass();
  }
}
