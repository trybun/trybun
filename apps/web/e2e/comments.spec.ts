import { expect, request, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { TicketPage } from './pages/ticket.page.js';
import { CUSTOMER_STORAGE_STATE } from './storage-state.js';

/** A ticket of the customer in the Customer portal project, created through the BFF (§14.4). */
async function customerTicket(baseURL: string, title: string): Promise<string> {
  const api = await request.newContext({
    baseURL,
    storageState: CUSTOMER_STORAGE_STATE,
    extraHTTPHeaders: { Origin: new URL(baseURL).origin },
  });
  try {
    const projects = (await (await api.get('/api/v1/projects')).json()) as {
      items: { id: string; key: string }[];
    };
    const project = projects.items.find(({ key }) => key === 'CP');
    expect(project).toBeDefined();
    const created = await api.post('/api/v1/tickets', {
      data: { projectId: project?.id, title },
    });
    expect(created.status()).toBe(201);
    return ((await created.json()) as { identifier: string }).identifier;
  } finally {
    await api.dispose();
  }
}

// Comments and internal notes of S1-12 (§6.1) on phone, tablet and desktop, with axe (§13.4): the
// team's note is labelled and preselected, and it never reaches the portal.
test.describe('comments and internal notes', () => {
  test('a Developer adds an internal note and a public comment; the customer sees only the comment', async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    const stamp = `${testInfo.project.name} ${Date.now()}`;
    const identifier = await customerTicket(baseURL ?? '', `Comments on ${stamp}`);
    const ticket = new TicketPage(page);
    const shell = new AppShellPage(page);
    await ticket.goto(identifier);
    const activity = ticket.activity;

    // The internal note is preselected (§6.1); the server-rendered form waits for the hydration.
    const note = activity.getByRole('radio', { name: 'Internal note' });
    await expect(note).toBeChecked();
    const field = activity.getByRole('textbox');
    await expect(async () => {
      await field.fill(`Root cause found ${stamp}`);
      await expect(field).toHaveValue(`Root cause found ${stamp}`, { timeout: 2_000 });
    }).toPass();
    await activity.getByRole('button', { name: 'Add internal note' }).click();
    const noteItem = activity
      .getByRole('listitem')
      .filter({ hasText: `Root cause found ${stamp}` });
    await expect(noteItem).toBeVisible();
    await expect(noteItem.getByText('Internal note')).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);

    await activity.getByRole('radio', { name: 'Public comment' }).click();
    await expect(activity.getByText('Visible to the requester')).toBeVisible();
    await field.fill(`We are on it ${stamp}`);
    await activity.getByRole('button', { name: 'Comment publicly' }).click();
    await expect(activity.getByText(`We are on it ${stamp}`)).toBeVisible();
    // A new form starts with the internal note again.
    await expect(note).toBeChecked();

    const customer = await browser.newContext({
      ...testInfo.project.use,
      storageState: CUSTOMER_STORAGE_STATE,
    });
    try {
      const portal = await customer.newPage();
      await portal.goto(`/portal/tickets/${identifier}`);
      const history = portal.getByRole('region', { name: 'History' });
      await expect(history.getByText(`We are on it ${stamp}`)).toBeVisible();
      await expect(portal.getByText(`Root cause found ${stamp}`)).toHaveCount(0);
      await expect(portal.getByText('Internal note')).toHaveCount(0);
      expect(await seriousViolations(portal)).toEqual([]);
    } finally {
      await customer.close();
    }
  });
});
