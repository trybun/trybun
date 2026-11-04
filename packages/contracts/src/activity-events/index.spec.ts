import { describe, expect, it } from 'vitest';
import {
  activityEventSchema,
  activityEventSourceSchema,
  activityEventTypeSchema,
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
