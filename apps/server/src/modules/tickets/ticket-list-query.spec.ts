import { listTicketsQuerySchema } from '@trybun/contracts/tickets';
import { describe, expect, it } from 'vitest';
import {
  assertNoTeamListParameters,
  ticketListConditions,
  ticketListOrder,
} from './ticket-list-query.js';

const ME = '0190f2f4-7c1e-7000-8000-000000000001';
const OTHER = '0190f2f4-7c1e-7000-8000-000000000002';

describe('assertNoTeamListParameters (S1-13 Q21)', () => {
  it('accepts the parameters of S1-05', () => {
    expect(() =>
      assertNoTeamListParameters(
        listTicketsQuerySchema.parse({ projectId: ME, identifier: 'ERP-1' }),
      ),
    ).not.toThrow();
  });

  it('names every parameter of the team with field.unrecognized', () => {
    expect(() =>
      assertNoTeamListParameters(
        listTicketsQuerySchema.parse({ assigneeId: 'me', sort: 'status' }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'request.validation_failed',
        errors: [
          { pointer: '/assigneeId', code: 'field.unrecognized' },
          { pointer: '/sort', code: 'field.unrecognized' },
        ],
      }),
    );
  });
});

describe('ticketListConditions', () => {
  it('resolves me to the principal and none to a missing value', () => {
    expect(ticketListConditions({ assigneeId: ['me', 'none', OTHER] }, ME)).toEqual([
      { OR: [{ assigneeId: { in: [ME, OTHER] } }, { assigneeId: null }] },
    ]);
  });

  it('combines the filters with AND', () => {
    expect(ticketListConditions({ status: ['new'], type: ['none'], projectId: [ME] }, ME)).toEqual([
      { projectId: { in: [ME] } },
      { OR: [{ type: null }] },
      { status: { in: ['new'] } },
    ]);
  });
});

describe('ticketListOrder', () => {
  const row = {
    id: OTHER,
    number: 7,
    priority: 'high',
    status: 'todo',
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-02T10:00:00.000Z'),
    project: { key: 'ERP' },
  };

  it('orders by the key, then the last update and the ID, newest first', () => {
    expect(ticketListOrder('priority', 'asc').orderBy).toEqual([
      { priority: 'asc' },
      { updatedAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('names the sort in the cursor, so a cursor of another order is not read', () => {
    const order = ticketListOrder('priority', 'desc');
    const cursor = order.cursorOf(row);

    expect(order.cursorSchema.safeParse(cursor).success).toBe(true);
    expect(ticketListOrder('status', 'desc').cursorSchema.safeParse(cursor).success).toBe(false);
    expect(ticketListOrder('priority', 'asc').cursorSchema.safeParse(cursor).success).toBe(false);
  });

  it('finds the rows after an enum value by the values that follow it', () => {
    const order = ticketListOrder('priority', 'desc');
    expect(order.after(order.cursorOf(row))).toEqual({
      OR: [
        { AND: [{ priority: { in: ['low', 'normal'] } }] },
        { AND: [{ priority: 'high' }, { updatedAt: { lt: row.updatedAt } }] },
        {
          AND: [{ priority: 'high' }, { updatedAt: row.updatedAt }, { id: { lt: OTHER } }],
        },
      ],
    });
  });
});
