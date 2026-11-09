// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Comment, EndUserComment } from '@trybun/contracts/comments';
import type { Ticket } from '@trybun/contracts/tickets';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';
import { ticketResponse } from '../../../../test/factories/ticket.factory.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));
vi.mock('@trybun/ui/components/toast', () => ({ toast: { add: vi.fn() } }));
vi.mock('next/navigation.js', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));
Object.defineProperty(document, 'execCommand', { value: () => false });

const { TimelineList } = await import('./timeline-list.js');

const fake = createFakeApiClient();
api.current = fake.client;

const COMMENT_ID = '0199a3f0-0000-7000-8000-000000000051';
const AUTHOR = { id: '0199a3f0-0000-7000-8000-000000000031', displayName: 'Anna' };

function teamComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: COMMENT_ID,
    ticketId: ticketResponse().id,
    author: AUTHOR,
    body: 'Checked the logs',
    mentions: [],
    attachments: [],
    editedAt: null,
    version: 1,
    createdAt: '2026-11-09T10:00:00.000Z',
    allowedActions: ['read', 'update', 'delete', 'redact', 'read_revisions'],
    kind: 'internal',
    audience: null,
    audienceOrganization: null,
    ...overrides,
  };
}

function answer(items: object[]) {
  fake.on('GET /api/v1/tickets/{ticketId}/timeline', { data: { items, nextCursor: null } });
  fake.on('GET /api/v1/attachments', { data: { items: [] } });
}

function renderTimeline(ticket: Ticket | object, isTeam = true) {
  return renderInApp(
    <TimelineList
      ticket={ticket as Ticket}
      isTeam={isTeam}
      attachmentMaxSizeMb={25}
      showMoreLabel="Show more"
      opening={<li>Opened</li>}
      renderEvent={() => null}
    />,
  );
}

afterEach(() => {
  cleanup();
  fake.reset();
});

describe('the comment field', () => {
  it('preselects the internal note for the team and names the audience of a public comment', async () => {
    const user = userEvent.setup();
    answer([]);
    renderTimeline(
      ticketResponse({
        visibility: 'my_organization',
        organization: { id: AUTHOR.id, name: 'Acme' },
        allowedActions: ['read', 'add_comment', 'add_internal_note'],
      }),
    );

    expect(await screen.findByRole('radio', { name: 'Internal note' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'Internal note' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Add internal note' })).toBeDefined();

    await user.click(screen.getByRole('radio', { name: 'Public comment' }));

    expect(await screen.findByText('Visible to organization Acme')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Comment publicly' })).toBeDefined();
  });

  it('sends the kind and the text, and starts again with an internal note', async () => {
    const user = userEvent.setup();
    answer([]);
    fake.on('POST /api/v1/tickets/{ticketId}/comments', { data: teamComment() });
    renderTimeline(
      ticketResponse({ allowedActions: ['read', 'add_comment', 'add_internal_note'] }),
    );

    await user.type(await screen.findByRole('textbox'), 'Root cause found');
    await user.click(screen.getByRole('button', { name: 'Add internal note' }));

    await waitFor(() =>
      expect(fake.callsTo('POST /api/v1/tickets/{ticketId}/comments')[0]?.init).toMatchObject({
        body: { kind: 'internal', body: 'Root cause found', attachmentIds: [] },
      }),
    );
  });

  it('offers Create a new ticket in the portal on a ticket closed for comments (§4.3)', async () => {
    answer([]);
    renderTimeline({ ...ticketResponse({ allowedActions: ['read'] }) }, false);

    expect(await screen.findByText('This ticket is closed for comments.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Create a new ticket' })).toBeDefined();
  });
});

describe('a comment', () => {
  it('labels an internal note and opens the history from "edited" (§6.1)', async () => {
    const user = userEvent.setup();
    answer([{ type: 'comment', comment: teamComment({ editedAt: '2026-11-09T11:00:00.000Z' }) }]);
    fake.on('GET /api/v1/comments/{commentId}/revisions', {
      data: {
        items: [
          {
            id: COMMENT_ID,
            body: 'First words',
            author: AUTHOR,
            writtenAt: '2026-11-09T10:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
    });
    renderTimeline(ticketResponse());

    const item = within((await screen.findByText('Checked the logs')).closest('li')!);
    expect(item.getByText('Internal note')).toBeDefined();
    await user.click(item.getByRole('button', { name: 'edited – show the edit history' }));

    expect(await screen.findByRole('dialog', { name: 'Edit history' })).toBeDefined();
    expect(await screen.findByText('First words')).toBeDefined();
  });

  it('shows "edited" as text to someone who may not read the history (Q3)', async () => {
    const comment: EndUserComment = {
      ...teamComment({ editedAt: '2026-11-09T11:00:00.000Z', allowedActions: ['read'] }),
    };
    answer([{ type: 'comment', comment }]);
    renderTimeline(ticketResponse(), false);

    expect(await screen.findByText('edited')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'edited – show the edit history' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Actions of the comment' })).toBeNull();
  });

  it('deletes a comment after the confirmation, with the version the person has seen', async () => {
    const user = userEvent.setup();
    answer([{ type: 'comment', comment: teamComment({ version: 3 }) }]);
    fake.on('DELETE /api/v1/comments/{commentId}', { status: 204 });
    renderTimeline(ticketResponse());

    await user.click(await screen.findByRole('button', { name: 'Actions of the comment' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete this comment?' }));
    await user.click(dialog.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(fake.callsTo('DELETE /api/v1/comments/{commentId}')[0]?.init).toMatchObject({
        params: { path: { commentId: COMMENT_ID } },
        headers: { 'If-Match': 'W/"3"' },
      }),
    );
  });

  it('shows a hidden mentioned person as Customer (§5.4)', async () => {
    answer([
      {
        type: 'comment',
        comment: teamComment({
          kind: 'public',
          audience: 'all_customers',
          body: 'Thanks @{customer}',
          mentions: [{ id: 'customer', displayName: null }],
        }),
      },
    ]);
    renderTimeline(ticketResponse());

    expect(await screen.findByText('@Customer')).toBeDefined();
  });
});
