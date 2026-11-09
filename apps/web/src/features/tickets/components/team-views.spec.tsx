// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ActivityEvent } from '@trybun/contracts/activity-events';
import type { Ticket } from '@trybun/contracts/tickets';
import type { CurrentUser } from '@trybun/contracts/users';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { TABLET_MEDIA_QUERY } from '@trybun/ui/hooks/use-media-query';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));
const toastAdd = vi.hoisted(() => vi.fn());
vi.mock('@trybun/ui/components/toast', () => ({ toast: { add: toastAdd } }));
vi.mock('next/navigation.js', () => ({ useRouter: () => ({ push: vi.fn() }) }));
// The fields adapt to the width (jsdom has no `matchMedia`): a tablet, with selects.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query === TABLET_MEDIA_QUERY,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

const { TeamTicketView } = await import('./team-ticket-view.js');
const { ActivityEventItem } = await import('./activity-event-item.js');

const fake = createFakeApiClient();
api.current = fake.client;

const PROJECT = { id: '0199a3f0-0000-7000-8000-000000000010', key: 'ERP', name: 'ERP system' };
const ANNA = { id: '0199a3f0-0000-7000-8000-000000000031', displayName: 'Anna' };
const JAN = { id: '0199a3f0-0000-7000-8000-000000000032', displayName: 'Jan' };
const FILE = { id: '0199a3f0-0000-7000-8000-0000000000a1', displayName: 'log.txt' };
const ORIGINAL = { id: '0199a3f0-0000-7000-8000-000000000027', number: 7, projectKey: 'ERP' };
const OTHER_ORIGINAL = { id: '0199a3f0-0000-7000-8000-000000000029', number: 9, projectKey: 'ERP' };

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: '0199a3f0-0000-7000-8000-000000000020',
    projectId: PROJECT.id,
    project: PROJECT,
    number: 12,
    identifier: 'ERP-12',
    title: 'Invoice totals are wrong',
    description: 'The total shows **23%**.',
    requester: { id: '0199a3f0-0000-7000-8000-000000000030', displayName: 'Celina Customer' },
    version: 3,
    createdAt: '2026-11-02T09:00:00.000Z',
    updatedAt: '2026-11-03T10:30:00.000Z',
    allowedActions: ['read', 'update', 'update_fields', 'assign', 'change_status'],
    publicStatus: 'in_progress',
    waitingReason: null,
    duplicateOf: null,
    visibility: 'only_me',
    sharingRequest: 'none',
    type: 'bug',
    source: 'user',
    priority: 'high',
    status: 'in_progress',
    organization: null,
    assignee: ANNA,
    closedAt: null,
    rejectionReason: null,
    sharingRefusalReason: null,
    ...overrides,
  };
}

function event(overrides: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: '0199a3f0-0000-7000-8000-000000000040',
    type: 'description_edited',
    data: null,
    actor: ANNA,
    automaticSource: null,
    createdAt: '2026-11-02T12:00:00.000Z',
    ...overrides,
  };
}

function currentUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: ANNA.id,
    displayName: ANNA.displayName,
    email: 'anna@example.com',
    kind: 'team',
    language: 'en',
    timeZone: null,
    hideTimelineEvents: false,
    allowedActions: [],
    ...overrides,
  };
}

function answer(
  value: Ticket,
  { events = [] as ActivityEvent[], projectState = 'active', hideTimelineEvents = false } = {},
) {
  fake.on('GET /api/v1/tickets', { data: { items: [value], nextCursor: null } });
  fake.on('GET /api/v1/users/me', { data: currentUser({ hideTimelineEvents }) });
  fake.on('GET /api/v1/projects/{projectId}', {
    data: {
      ...PROJECT,
      state: projectState,
      allowedActions: projectState === 'active' ? ['read', 'create_ticket'] : ['read'],
    },
  });
  fake.on('GET /api/v1/tickets/{ticketId}/activity-events', {
    data: { items: events, nextCursor: null },
  });
  fake.on('GET /api/v1/tickets/{ticketId}/attachments', { data: { items: [], nextCursor: null } });
}

/** The fields of the field panel: label → value. */
function fieldsOf(panel: HTMLElement): Record<string, string | null | undefined> {
  return Object.fromEntries(
    within(panel)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent]),
  );
}

afterEach(() => {
  cleanup();
  fake.reset();
  toastAdd.mockClear();
});

describe('TeamTicketView', () => {
  it('shows the header, the rendered description and the fields of the ticket (§3.2)', async () => {
    // Without the actions that change them, the fields are text.
    answer(ticket({ allowedActions: ['read'] }));
    renderInApp(<TeamTicketView identifier="ERP-12" attachmentMaxSizeMb={25} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Invoice totals are wrong' }),
    ).toBeDefined();
    expect(screen.getByText('ERP-12')).toBeDefined();
    // Who opened it, when (relative, with the exact time on the element) and through which source.
    const opened = screen.getByText(
      (_content, element) =>
        element?.tagName === 'P' &&
        /^Celina Customer opened .+ ago · User$/.test(element.textContent ?? ''),
    );
    expect(opened.querySelector('time')?.getAttribute('dateTime')).toBe('2026-11-02T09:00:00.000Z');
    const description = screen.getByRole('region', { name: 'Description' });
    expect(within(description).getByText('23%').tagName).toBe('STRONG');
    expect(fieldsOf(screen.getByRole('region', { name: 'Details' }))).toEqual({
      Status: 'In progress',
      Assignee: 'Anna',
      Type: 'Bug',
      Priority: 'High',
      Project: 'ERP system',
      Requester: 'Celina Customer',
      Created: 'Nov 2, 2026, 9:00 AM',
      Updated: 'Nov 3, 2026, 10:30 AM',
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a type not set, no assignee, the waiting reason and the organization when there is one', async () => {
    answer(
      ticket({
        type: null,
        assignee: null,
        status: 'waiting_for_requester',
        waitingReason: 'information',
        organization: { id: '0199a3f0-0000-7000-8000-000000000050', name: 'Customer Ltd' },
        allowedActions: ['read'],
      }),
    );
    renderInApp(<TeamTicketView identifier="ERP-12" attachmentMaxSizeMb={25} />);

    const fields = fieldsOf(await screen.findByRole('region', { name: 'Details' }));
    expect(fields).toMatchObject({
      Type: 'Not set',
      Assignee: 'Unassigned',
      Status: 'Waiting for requesterWaiting for information',
      Organization: 'Customer Ltd',
    });
  });

  it('says that the project is archived and read-only (S1-01)', async () => {
    answer(ticket({ allowedActions: ['read'] }), { projectState: 'archived' });
    renderInApp(<TeamTicketView identifier="ERP-12" attachmentMaxSizeMb={25} />);

    expect(await screen.findByText('This project is archived and read-only.')).toBeDefined();
  });

  it('copies the identifier', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    answer(ticket());
    renderInApp(<TeamTicketView identifier="ERP-12" attachmentMaxSizeMb={25} />);

    await user.click(await screen.findByRole('button', { name: 'Copy identifier ERP-12' }));

    expect(writeText).toHaveBeenCalledWith('ERP-12');
    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({ title: 'Identifier ERP-12 copied', type: 'success' }),
    );
  });

  it('shows the opening item first, then the events oldest first, and pages with Show more (Q13)', async () => {
    const user = userEvent.setup();
    const value = ticket();
    answer(value);
    fake.on('GET /api/v1/tickets/{ticketId}/activity-events', (init) => {
      const cursor = (init as { params: { query: { cursor?: string } } }).params.query.cursor;
      return cursor === undefined
        ? {
            data: {
              items: [event({ id: '0199a3f0-0000-7000-8000-000000000041' })],
              nextCursor: 'next',
            },
          }
        : {
            data: {
              items: [
                event({
                  id: '0199a3f0-0000-7000-8000-000000000042',
                  type: 'priority_changed',
                  data: { from: 'normal', to: 'high' },
                  actor: JAN,
                }),
              ],
              nextCursor: null,
            },
          };
    });
    renderInApp(<TeamTicketView identifier="ERP-12" attachmentMaxSizeMb={25} />);

    const activity = within(await screen.findByRole('region', { name: 'Activity' }));
    await activity.findByText('Anna edited the description');
    await user.click(activity.getByRole('button', { name: 'Show more' }));

    await activity.findByText('Jan changed the priority: Normal → High');
    expect(
      activity
        .getAllByRole('listitem')
        .map((item) => item.firstElementChild?.textContent)
        .slice(0, 3),
    ).toEqual([
      'Celina Customer opened the ticket',
      'Anna edited the description',
      'Jan changed the priority: Normal → High',
    ]);
    expect(activity.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(fake.callsTo('GET /api/v1/tickets/{ticketId}/activity-events')[1]?.init).toMatchObject({
      params: { path: { ticketId: value.id }, query: { cursor: 'next' } },
    });
  });
});

describe('Hide events', () => {
  it('shows no events and requests none while the setting is on (Q5)', async () => {
    answer(ticket(), { hideTimelineEvents: true, events: [event({})] });
    renderInApp(<TeamTicketView identifier="ERP-12" attachmentMaxSizeMb={25} />);

    const activity = within(await screen.findByRole('region', { name: 'Activity' }));
    expect(await activity.findByText('Events are hidden. Comments appear here.')).toBeDefined();
    expect(activity.getByRole('switch', { name: 'Hide events' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(activity.queryByRole('listitem')).toBeNull();
    expect(fake.callsTo('GET /api/v1/tickets/{ticketId}/activity-events')).toHaveLength(0);
  });

  it('hides the events at once and stores the setting on the account', async () => {
    const user = userEvent.setup();
    answer(ticket(), { events: [event({})] });
    // The server has not answered yet: the switch already shows the new state (§18.5).
    const patch = fake.client.PATCH.getMockImplementation();
    fake.client.PATCH.mockImplementationOnce((path: string, init?: unknown) => {
      fake.calls.push({ method: 'PATCH', path, init });
      return new Promise(() => undefined);
    });
    const { client } = renderInApp(<TeamTicketView identifier="ERP-12" attachmentMaxSizeMb={25} />);
    const activity = within(await screen.findByRole('region', { name: 'Activity' }));
    await activity.findByText('Anna edited the description');

    try {
      await user.click(activity.getByRole('switch', { name: 'Hide events' }));

      expect(await activity.findByText('Events are hidden. Comments appear here.')).toBeDefined();
      expect(activity.queryByText('Anna edited the description')).toBeNull();
      expect(fake.callsTo('PATCH /api/v1/users/me')[0]?.init).toEqual({
        body: { hideTimelineEvents: true },
      });
      expect(client.getQueryData<CurrentUser>(['users', 'me'])?.hideTimelineEvents).toBe(true);
    } finally {
      fake.client.PATCH.mockImplementation(patch!);
    }
  });

  it('shows the events again and requests them when the setting is turned off', async () => {
    const user = userEvent.setup();
    answer(ticket(), { hideTimelineEvents: true, events: [event({})] });
    fake.on('PATCH /api/v1/users/me', { data: currentUser({ hideTimelineEvents: false }) });
    renderInApp(<TeamTicketView identifier="ERP-12" attachmentMaxSizeMb={25} />);
    const activity = within(await screen.findByRole('region', { name: 'Activity' }));

    await user.click(await activity.findByRole('switch', { name: 'Hide events' }));

    expect(await activity.findByText('Anna edited the description')).toBeDefined();
    expect(activity.queryByText('Events are hidden. Comments appear here.')).toBeNull();
    expect(fake.callsTo('GET /api/v1/tickets/{ticketId}/activity-events')).toHaveLength(1);
  });

  it('waits for the answer before the next change, so an older answer never wins', async () => {
    const user = userEvent.setup();
    answer(ticket(), { events: [event({})] });
    let respond: (() => void) | undefined;
    fake.client.PATCH.mockImplementationOnce((path: string, init?: unknown) => {
      fake.calls.push({ method: 'PATCH', path, init });
      return new Promise((resolve) => {
        respond = () =>
          resolve({
            data: currentUser({ hideTimelineEvents: true }),
            response: new Response(null, { status: 200 }),
          });
      });
    });
    renderInApp(<TeamTicketView identifier="ERP-12" attachmentMaxSizeMb={25} />);
    const activity = within(await screen.findByRole('region', { name: 'Activity' }));
    await activity.findByText('Anna edited the description');
    const toggle = activity.getByRole('switch', { name: 'Hide events' });

    await user.click(toggle);
    await user.click(toggle);

    expect(toggle.hasAttribute('data-disabled')).toBe(true);
    expect(fake.callsTo('PATCH /api/v1/users/me')).toHaveLength(1);
    respond?.();
    await waitFor(() => expect(toggle.hasAttribute('data-disabled')).toBe(false));
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('returns to the previous state and says why when saving fails', async () => {
    const user = userEvent.setup();
    answer(ticket(), { events: [event({})] });
    fake.on('PATCH /api/v1/users/me', {
      status: 503,
      error: { type: 'about:blank', title: 'Unavailable', status: 503, code: 'server.unavailable' },
    });
    renderInApp(<TeamTicketView identifier="ERP-12" attachmentMaxSizeMb={25} />);
    const activity = within(await screen.findByRole('region', { name: 'Activity' }));
    await activity.findByText('Anna edited the description');

    await user.click(activity.getByRole('switch', { name: 'Hide events' }));

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })),
    );
    expect(activity.getByRole('switch', { name: 'Hide events' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(await activity.findByText('Anna edited the description')).toBeDefined();
  });
});

describe('ActivityEventItem', () => {
  function renderEvent(value: ActivityEvent, locale: 'en' | 'pl' = 'en') {
    render(
      <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]} timeZone="UTC">
        <ol>
          <ActivityEventItem event={value} />
        </ol>
      </NextIntlClientProvider>,
    );
    return screen.getByRole('listitem').firstElementChild?.textContent;
  }

  // One catalogue text per event type of S1-05, S1-06, S1-08 and S1-11 (§4.5).
  it.each<[string, Partial<ActivityEvent>, string]>([
    [
      'title_changed',
      { type: 'title_changed', data: { from: 'Old title', to: 'New title' } },
      'Anna changed the title: “Old title” → “New title”',
    ],
    ['description_edited', { type: 'description_edited' }, 'Anna edited the description'],
    [
      'type_changed',
      { type: 'type_changed', data: { from: null, to: 'feature' } },
      'Anna changed the type: Not set → Feature',
    ],
    [
      'priority_changed',
      { type: 'priority_changed', data: { from: 'normal', to: 'critical' } },
      'Anna changed the priority: Normal → Critical',
    ],
    [
      'assignee_changed (assigned)',
      { type: 'assignee_changed', data: { from: null, to: JAN } },
      'Anna assigned Jan',
    ],
    [
      'assignee_changed (changed)',
      { type: 'assignee_changed', data: { from: JAN, to: ANNA } },
      'Anna changed the assignee: Jan → Anna',
    ],
    [
      'assignee_changed (removed by the system)',
      {
        type: 'assignee_changed',
        data: { from: JAN, to: null },
        actor: null,
        automaticSource: 'system',
      },
      'System removed the assignee Jan',
    ],
    [
      'status_changed',
      { type: 'status_changed', data: { from: 'todo', to: 'in_progress', reopen: false } },
      'Anna changed the status: To do → In progress',
    ],
    [
      'status_changed (waiting)',
      {
        type: 'status_changed',
        data: {
          from: 'in_progress',
          to: 'waiting_for_requester',
          reopen: false,
          waitingReason: 'information',
        },
      },
      'Anna changed the status: In progress → Waiting for requester (Waiting for information)',
    ],
    [
      'status_changed (new waiting reason)',
      {
        type: 'status_changed',
        data: {
          from: 'waiting_for_requester',
          to: 'waiting_for_requester',
          reopen: false,
          waitingReason: 'confirmation',
        },
      },
      'Anna changed the waiting reason: Waiting for confirmation',
    ],
    [
      'status_changed (reopen)',
      { type: 'status_changed', data: { from: 'done', to: 'triage', reopen: true } },
      'Anna reopened the ticket: Done → Triage',
    ],
    [
      'status_changed (duplicate)',
      {
        type: 'status_changed',
        data: { from: 'triage', to: 'duplicate', reopen: false, duplicateOf: ORIGINAL },
      },
      'Anna marked this as a duplicate of ERP-7',
    ],
    [
      'duplicate_original_changed',
      { type: 'duplicate_original_changed', data: { from: ORIGINAL, to: OTHER_ORIGINAL } },
      'Anna changed the original: ERP-7 → ERP-9',
    ],
    [
      'duplicate_link_removed',
      { type: 'duplicate_link_removed', data: { from: ORIGINAL, to: null } },
      'Anna removed the link to the original ERP-7',
    ],
    [
      'rejection_reason_changed',
      { type: 'rejection_reason_changed' },
      'Anna changed the rejection reason',
    ],
    [
      'attachment_added',
      { type: 'attachment_added', data: { from: null, to: FILE } },
      'Anna added the file log.txt',
    ],
    [
      'attachment_deleted',
      { type: 'attachment_deleted', data: { from: FILE, to: null } },
      'Anna deleted the file log.txt',
    ],
    [
      'visibility_changed',
      { type: 'visibility_changed', data: { from: 'all_customers', to: 'only_me' } },
      'Anna changed the visibility: All customers → Only me',
    ],
    [
      'sharing_requested',
      { type: 'sharing_requested', data: { from: 'only_me', to: 'my_organization' } },
      'Anna asked to share the ticket with all customers',
    ],
    [
      'sharing_request_withdrawn',
      { type: 'sharing_request_withdrawn', data: { from: 'my_organization', to: 'only_me' } },
      'Anna withdrew the request to share the ticket with all customers',
    ],
    [
      'sharing_approved',
      { type: 'sharing_approved', data: { from: 'my_organization', to: 'all_customers' } },
      'Anna shared the ticket with all customers',
    ],
    [
      'sharing_rejected',
      { type: 'sharing_rejected' },
      'Anna did not share the ticket with all customers',
    ],
    [
      'an anonymized actor and assignee',
      {
        type: 'assignee_changed',
        data: { from: null, to: { id: JAN.id, displayName: null } },
        actor: { id: ANNA.id, displayName: null },
      },
      'Deleted user assigned Deleted user',
    ],
  ])('shows %s', (_name, overrides, expected) => {
    expect(renderEvent(event(overrides))).toBe(expected);
  });

  it('shows the codes with their labels in the reader’s language', () => {
    expect(
      renderEvent(event({ type: 'priority_changed', data: { from: 'normal', to: 'high' } }), 'pl'),
    ).toBe('Anna – zmiana priorytetu: Normalny → Wysoki');
  });

  it('shows the time of the event', () => {
    renderEvent(event({}));

    expect(screen.getByText('Nov 2, 2026, 12:00 PM').getAttribute('dateTime')).toBe(
      '2026-11-02T12:00:00.000Z',
    );
  });
});
