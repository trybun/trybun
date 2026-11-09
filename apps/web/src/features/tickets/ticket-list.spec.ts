import { describe, expect, it } from 'vitest';
import {
  OPEN_TICKET_STATUSES,
  filtersOfView,
  parseTicketListSearchParams,
  stateOfView,
  ticketListHref,
  withFilters,
} from './ticket-list.js';

const PROJECT = '0199a3f0-0000-7000-8000-000000000010';

describe('the predefined views (§8.1, S1-13 Q4, Q20)', () => {
  it.each([
    ['my_open_tickets', { assigneeId: ['me'], status: OPEN_TICKET_STATUSES }, 'priority', 'desc'],
    ['triage', { status: ['new', 'triage'] }, 'createdAt', 'asc'],
    ['critical', { priority: ['critical'], status: OPEN_TICKET_STATUSES }, 'updatedAt', 'desc'],
    ['unassigned', { assigneeId: ['none'], status: OPEN_TICKET_STATUSES }, 'priority', 'desc'],
    ['pending_sharing_approvals', { sharingRequest: ['pending'] }, 'createdAt', 'asc'],
  ] as const)('%s filters %j, sorted by %s %s', (view, filters, sort, order) => {
    expect(stateOfView(view)).toEqual({ view, filters, sort, order });
  });

  it('counts the six non-terminal statuses as open', () => {
    expect(OPEN_TICKET_STATUSES).toEqual([
      'new',
      'triage',
      'todo',
      'in_progress',
      'in_verification',
      'waiting_for_requester',
    ]);
  });
});

describe('parseTicketListSearchParams', () => {
  it.each([
    [{}, 'my_open_tickets', filtersOfView('my_open_tickets'), 'priority', 'desc'],
    [{ view: 'triage' }, 'triage', filtersOfView('triage'), 'createdAt', 'asc'],
    [{ view: 'triage', status: 'done' }, 'triage', filtersOfView('triage'), 'createdAt', 'asc'],
    [{ view: 'custom' }, 'custom', {}, 'priority', 'desc'],
    [{ status: ['new', 'done'] }, 'custom', { status: ['new', 'done'] }, 'priority', 'desc'],
    [{ projectId: PROJECT, sort: 'status' }, 'custom', { projectId: [PROJECT] }, 'status', 'desc'],
    [
      { view: 'critical', sort: 'identifier', order: 'asc' },
      'critical',
      filtersOfView('critical'),
      'identifier',
      'asc',
    ],
    // An invalid value drops its filter instead of failing the page.
    [{ status: 'closed', priority: 'high' }, 'custom', { priority: ['high'] }, 'priority', 'desc'],
    [{ view: 'unknown' }, 'my_open_tickets', filtersOfView('my_open_tickets'), 'priority', 'desc'],
  ])('reads %j as %s', (params, view, filters, sort, order) => {
    expect(parseTicketListSearchParams(params)).toEqual({ view, filters, sort, order });
  });
});

describe('ticketListHref', () => {
  it('writes a predefined view by its code, with a sort only when it is not the default', () => {
    expect(ticketListHref(stateOfView('triage'))).toBe('/tickets?view=triage');
    expect(ticketListHref({ ...stateOfView('triage'), sort: 'priority', order: 'desc' })).toBe(
      '/tickets?view=triage&sort=priority&order=desc',
    );
  });

  it('writes own filters as parameters and empty own filters as view=custom', () => {
    expect(
      ticketListHref(withFilters(stateOfView('triage'), { status: ['new'], projectId: [PROJECT] })),
    ).toBe(`/tickets?projectId=${PROJECT}&status=new`);
    expect(ticketListHref(withFilters(stateOfView('triage'), {}))).toBe('/tickets?view=custom');
  });

  it('round-trips every state through the URL', () => {
    for (const state of [
      stateOfView('pending_sharing_approvals'),
      withFilters(stateOfView('my_open_tickets'), { assigneeId: ['me', 'none'], type: ['none'] }),
      {
        ...withFilters(stateOfView('critical'), {}),
        sort: 'updatedAt' as const,
        order: 'asc' as const,
      },
    ]) {
      const params = new URLSearchParams(ticketListHref(state).split('?')[1]);
      const raw: Record<string, string | string[]> = {};
      for (const key of new Set(params.keys())) {
        const values = params.getAll(key);
        raw[key] = values.length === 1 ? (values[0] ?? '') : values;
      }
      expect(parseTicketListSearchParams(raw)).toEqual(state);
    }
  });

  it('keeps a changed sort when the filters change, and the default sort otherwise', () => {
    expect(withFilters(stateOfView('triage'), { status: ['new'] })).toMatchObject({
      sort: 'priority',
      order: 'desc',
    });
    expect(
      withFilters({ ...stateOfView('triage'), sort: 'identifier', order: 'asc' }, {}),
    ).toMatchObject({ sort: 'identifier', order: 'asc' });
  });
});
