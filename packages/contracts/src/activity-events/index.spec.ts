import { describe, expect, it } from 'vitest';
import {
  activityEventResponseSchema,
  activityEventSchema,
  activityEventSourceSchema,
  activityEventTypeSchema,
  endUserActivityEventSchema,
} from './index.js';

const ID = '0190f2f4-7c1e-7000-8000-000000000001';

describe('activity event enums', () => {
  it.each([
    [
      activityEventTypeSchema,
      [
        'title_changed',
        'description_edited',
        'type_changed',
        'priority_changed',
        'assignee_changed',
        'status_changed',
        'duplicate_original_changed',
        'duplicate_link_removed',
        'rejection_reason_changed',
        'attachment_added',
        'attachment_deleted',
        'visibility_changed',
        'sharing_requested',
        'sharing_request_withdrawn',
        'sharing_approved',
        'sharing_rejected',
        'comment_edited',
        'comment_deleted',
        'comment_redacted',
        'description_redacted',
      ],
    ],
    [activityEventSourceSchema, ['system']],
  ])('lists the codes', (schema, codes) => {
    expect(schema.options).toEqual(codes);
  });
});

describe('activityEventSchema', () => {
  it.each([
    ['an enum change', { from: 'low', to: 'high' }],
    ['a snapshot of a reference', { from: { id: ID, displayName: 'Ewa' }, to: null }],
    ['no data', null],
    [
      'a status change into a duplicate',
      {
        from: 'todo',
        to: 'duplicate',
        reopen: false,
        waitingReason: null,
        duplicateOf: { id: ID, number: 7, projectKey: 'ERP' },
      },
    ],
    [
      'a snapshot of a ticket',
      {
        from: { id: ID, number: 7, projectKey: 'ERP' },
        to: { id: ID, number: 9, projectKey: 'ERP' },
      },
    ],
  ])('accepts %s', (_case, data) => {
    const event = {
      id: ID,
      type: 'assignee_changed',
      data,
      actor: null,
      automaticSource: 'system',
      createdAt: '2026-11-04T10:00:00.000Z',
    };

    expect(activityEventSchema.parse(event)).toEqual(event);
  });
});

describe('endUserActivityEventSchema', () => {
  const event = {
    id: ID,
    type: 'status_changed',
    data: {
      from: 'in_progress',
      to: 'closed',
      duplicateOf: { id: ID, number: 7, projectKey: 'ERP' },
    },
    actor: { id: ID, displayName: 'Ewa' },
    automaticSource: null,
    createdAt: '2026-11-04T10:00:00.000Z',
  };

  it('accepts a status change with public codes', () => {
    expect(endUserActivityEventSchema.parse(event)).toEqual(event);
    expect(activityEventResponseSchema.parse(event)).toEqual(event);
  });

  it.each(['in_verification', 'waiting_for_requester', 'duplicate'])(
    'rejects the internal status %s',
    (status) => {
      expect(
        endUserActivityEventSchema.safeParse({ ...event, data: { from: 'received', to: status } })
          .success,
      ).toBe(false);
    },
  );

  it.each([
    ['added', { from: null, to: { id: ID, displayName: 'screenshot.png' } }],
    ['deleted', { from: { id: ID, displayName: 'log.txt' }, to: null }],
  ])('accepts the snapshot of a file %s', (_case, data) => {
    const attachmentEvent = { ...event, type: `attachment_${_case}`, data };

    expect(endUserActivityEventSchema.parse(attachmentEvent)).toEqual(attachmentEvent);
  });

  it('strips the internal data of a status change', () => {
    expect(
      endUserActivityEventSchema.parse({
        ...event,
        data: { from: 'received', to: 'in_progress', reopen: true, waitingReason: null },
      }).data,
    ).toEqual({ from: 'received', to: 'in_progress' });
  });
});
