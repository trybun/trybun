import type { ActivityEvent } from '@trybun/contracts/activity-events';
import { describe, expect, it } from 'vitest';
import { originalIdsOf, toEndUserEvent } from './end-user-events.js';

const ID = '0190f2f4-7c1e-7000-8000-000000000001';
const ORIGINAL = { id: '0190f2f4-7c1e-7000-8000-000000000002', number: 7, projectKey: 'ERP' };

function statusChanged(data: ActivityEvent['data']): ActivityEvent {
  return {
    id: ID,
    type: 'status_changed',
    data,
    actor: { id: ID, displayName: 'Ewa' },
    automaticSource: null,
    createdAt: '2026-11-04T10:00:00.000Z',
  };
}

describe('toEndUserEvent', () => {
  it.each([
    [
      'a change into verification',
      { from: 'new', to: 'in_verification', reopen: false, waitingReason: null },
      { from: 'received', to: 'in_progress' },
    ],
    [
      'a reopen into waiting',
      { from: 'done', to: 'waiting_for_requester', reopen: true, waitingReason: 'information' },
      { from: 'resolved', to: 'awaiting_reply' },
    ],
    [
      'a duplicate of a readable original',
      { from: 'triage', to: 'duplicate', reopen: false, duplicateOf: ORIGINAL },
      { from: 'received', to: 'closed', duplicateOf: ORIGINAL },
    ],
    [
      'a duplicate of an unreadable original',
      {
        from: 'todo',
        to: 'duplicate',
        reopen: false,
        duplicateOf: { ...ORIGINAL, id: '0190f2f4-7c1e-7000-8000-000000000003' },
      },
      { from: 'in_progress', to: 'closed' },
    ],
  ])('keeps only the public codes of %s', (_case, data, expected) => {
    expect(toEndUserEvent(statusChanged(data), new Set([ORIGINAL.id]))).toEqual({
      ...statusChanged(null),
      data: expected,
    });
  });

  it.each([
    ['attachment_added', { from: null, to: { id: ID, displayName: 'screenshot.png' } }],
    ['attachment_deleted', { from: { id: ID, displayName: 'log.txt' }, to: null }],
  ] as const)('keeps the file snapshot of %s', (type, data) => {
    const event: ActivityEvent = { ...statusChanged(null), type, data };

    expect(toEndUserEvent(event, new Set())).toEqual(event);
  });

  it('keeps no data of another type', () => {
    const event: ActivityEvent = {
      ...statusChanged(null),
      type: 'priority_changed',
      data: { from: 'low', to: 'high' },
    };

    expect(toEndUserEvent(event, new Set()).data).toBeNull();
  });
});

describe('originalIdsOf', () => {
  it('lists each original of a status change once', () => {
    expect(
      originalIdsOf([
        statusChanged({ from: 'todo', to: 'duplicate', duplicateOf: ORIGINAL }),
        statusChanged({ from: 'new', to: 'duplicate', duplicateOf: ORIGINAL }),
        statusChanged({ from: 'new', to: 'todo', duplicateOf: null }),
      ]),
    ).toEqual([ORIGINAL.id]);
  });
});
