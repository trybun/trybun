import { describe, expect, it } from 'vitest';
import {
  createTicketSchema,
  listTicketsQuerySchema,
  ticketActionSchema,
  ticketIdentifier,
  ticketPrioritySchema,
  ticketResponseSchema,
  ticketSourceSchema,
  ticketStatusSchema,
  ticketTypeSchema,
  updateTicketSchema,
} from './index.js';

const PROJECT_ID = '0190f2f4-7c1e-7000-8000-000000000001';

describe('ticket enums', () => {
  it.each([
    [ticketTypeSchema, ['bug', 'feature', 'task', 'question']],
    [ticketSourceSchema, ['user', 'developer', 'integration']],
    [ticketPrioritySchema, ['low', 'normal', 'high', 'critical']],
    [
      ticketStatusSchema,
      [
        'new',
        'triage',
        'todo',
        'in_progress',
        'in_verification',
        'waiting_for_requester',
        'done',
        'rejected',
        'duplicate',
      ],
    ],
    [ticketActionSchema, ['read', 'update', 'update_fields', 'assign', 'assign_self']],
  ])('lists the codes', (schema, codes) => {
    expect(schema.options).toEqual(codes);
  });
});

describe('createTicketSchema', () => {
  it.each([
    ['  Login fails  ', 'Login fails'],
    ['x'.repeat(255), 'x'.repeat(255)],
  ])('trims the title %j', (title, trimmed) => {
    expect(createTicketSchema.parse({ projectId: PROJECT_ID, title }).title).toBe(trimmed);
  });

  it.each(['', '   ', 'x'.repeat(256)])('rejects the title %j', (title) => {
    expect(createTicketSchema.safeParse({ projectId: PROJECT_ID, title }).success).toBe(false);
  });

  it.each([
    ['x'.repeat(65_536), true],
    ['x'.repeat(65_537), false],
  ])('limits the description to 65,536 characters', (description, isValid) => {
    expect(
      createTicketSchema.safeParse({ projectId: PROJECT_ID, title: 'T', description }).success,
    ).toBe(isValid);
  });
});

describe('updateTicketSchema', () => {
  it('needs at least one field', () => {
    expect(updateTicketSchema.safeParse({}).success).toBe(false);
  });

  it('accepts unassigning with null', () => {
    expect(updateTicketSchema.parse({ assigneeId: null })).toEqual({ assigneeId: null });
  });
});

describe('ticket identifiers', () => {
  it('composes the identifier from the key and the number', () => {
    expect(ticketIdentifier('ERP', 12)).toBe('ERP-12');
  });

  it.each([
    ['ERP-12', true],
    ['E2-1', true],
    ['erp-12', false],
    ['ERP-0', false],
    ['ERP-012', false],
    ['ERP12', false],
  ])('accepts the identifier %s: %s', (identifier, isValid) => {
    expect(listTicketsQuerySchema.safeParse({ identifier }).success).toBe(isValid);
  });
});

describe('ticketResponseSchema', () => {
  const common = {
    id: PROJECT_ID,
    projectId: PROJECT_ID,
    number: 1,
    identifier: 'ERP-1',
    title: 'Login fails',
    description: '',
    requester: { id: PROJECT_ID, displayName: 'Ewa' },
    version: 1,
    createdAt: '2026-11-04T10:00:00.000Z',
    updatedAt: '2026-11-04T10:00:00.000Z',
    allowedActions: ['read'],
  };

  it("keeps the team's fields of a team ticket", () => {
    const ticket = {
      ...common,
      type: 'bug',
      source: 'developer',
      priority: 'normal',
      status: 'todo',
      organization: null,
      assignee: null,
    };

    expect(ticketResponseSchema.parse(ticket)).toEqual(ticket);
  });

  it("strips every field outside the end user's shape", () => {
    expect(ticketResponseSchema.parse({ ...common, source: 'user', priority: 'high' })).toEqual(
      common,
    );
  });
});
