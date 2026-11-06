import { describe, expect, it } from 'vitest';
import { type FieldChange, fieldChanges, type TrackedTicketFields } from './field-changes.js';

const EWA = { id: '0190f2f4-7c1e-7000-8000-000000000001', displayName: 'Ewa Nowak' };
const JAN = { id: '0190f2f4-7c1e-7000-8000-000000000002', displayName: 'Jan Kowalski' };

const BEFORE: TrackedTicketFields = {
  title: 'Login fails',
  description: 'Steps',
  type: null,
  priority: 'normal',
  assignee: null,
};

describe('fieldChanges', () => {
  it.each<[string, Partial<TrackedTicketFields>, FieldChange[]]>([
    [
      'the title',
      { title: 'Sign-in fails' },
      [{ type: 'title_changed', data: { from: 'Login fails', to: 'Sign-in fails' } }],
    ],
    [
      'the description, without its text',
      { description: 'More steps' },
      [{ type: 'description_edited', data: null }],
    ],
    ['the type', { type: 'bug' }, [{ type: 'type_changed', data: { from: null, to: 'bug' } }]],
    [
      'the priority',
      { priority: 'high' },
      [{ type: 'priority_changed', data: { from: 'normal', to: 'high' } }],
    ],
    [
      'the assignee, as a snapshot',
      { assignee: EWA },
      [{ type: 'assignee_changed', data: { from: null, to: EWA } }],
    ],
  ])('records a change of %s', (_field, change, events) => {
    expect(fieldChanges(BEFORE, { ...BEFORE, ...change })).toEqual(events);
  });

  it('records one event per changed field, in a fixed order', () => {
    const after = { ...BEFORE, priority: 'high', title: 'Sign-in fails', assignee: JAN };

    expect(fieldChanges(BEFORE, after).map(({ type }) => type)).toEqual([
      'title_changed',
      'priority_changed',
      'assignee_changed',
    ]);
  });

  it('records a change between two assignees and an unassignment', () => {
    expect(fieldChanges({ ...BEFORE, assignee: EWA }, { ...BEFORE, assignee: JAN })).toEqual([
      { type: 'assignee_changed', data: { from: EWA, to: JAN } },
    ]);
    expect(fieldChanges({ ...BEFORE, assignee: EWA }, BEFORE)).toEqual([
      { type: 'assignee_changed', data: { from: EWA, to: null } },
    ]);
  });

  it('records nothing for an unchanged ticket or a renamed assignee', () => {
    expect(fieldChanges(BEFORE, { ...BEFORE })).toEqual([]);
    expect(
      fieldChanges(
        { ...BEFORE, assignee: EWA },
        { ...BEFORE, assignee: { ...EWA, displayName: 'Ewa' } },
      ),
    ).toEqual([]);
  });
});
