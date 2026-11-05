import { describe, expect, it } from 'vitest';
import { toFieldErrorCode } from '../problem-details/index.js';
import {
  changeTicketStatusSchema,
  confirmResolutionSchema,
  createTicketSchema,
  isTerminalStatus,
  publicStatusOf,
  resolutionAnswerSchema,
  listTicketsQuerySchema,
  ticketActionSchema,
  ticketIdentifier,
  ticketPrioritySchema,
  ticketPublicStatusSchema,
  ticketResponseSchema,
  ticketSourceSchema,
  ticketStatusSchema,
  ticketTypeSchema,
  ticketWaitingReasonSchema,
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
    [
      ticketActionSchema,
      [
        'read',
        'update',
        'update_fields',
        'assign',
        'assign_self',
        'change_status',
        'confirm_resolution',
      ],
    ],
    [ticketWaitingReasonSchema, ['information', 'confirmation']],
    [ticketPublicStatusSchema, ['received', 'awaiting_reply', 'in_progress', 'resolved', 'closed']],
    [resolutionAnswerSchema, ['solved', 'not_solved']],
  ])('lists the codes', (schema, codes) => {
    expect(schema.options).toEqual(codes);
  });
});

describe('status mapping', () => {
  it.each([
    ['new', 'received', false],
    ['triage', 'received', false],
    ['todo', 'in_progress', false],
    ['in_progress', 'in_progress', false],
    ['in_verification', 'in_progress', false],
    ['waiting_for_requester', 'awaiting_reply', false],
    ['done', 'resolved', true],
    ['rejected', 'closed', true],
    ['duplicate', 'closed', true],
  ] as const)('maps %s to %s (terminal: %s)', (status, publicStatus, terminal) => {
    expect(publicStatusOf(status)).toBe(publicStatus);
    expect(isTerminalStatus(status)).toBe(terminal);
  });

  it('maps every internal status', () => {
    for (const status of ticketStatusSchema.options) {
      expect(ticketPublicStatusSchema.options).toContain(publicStatusOf(status));
    }
  });
});

describe('changeTicketStatusSchema', () => {
  const ORIGINAL_ID = '0190f2f4-7c1e-7000-8000-000000000002';

  it('trims the rejection reason', () => {
    expect(
      changeTicketStatusSchema.parse({ status: 'rejected', rejectionReason: '  Out of scope ' }),
    ).toEqual({ status: 'rejected', rejectionReason: 'Out of scope' });
  });

  it.each([
    [{ status: 'rejected' }, '/rejectionReason', 'field.invalid_type'],
    [{ status: 'rejected', rejectionReason: '   ' }, '/rejectionReason', 'string.empty'],
    [
      { status: 'rejected', rejectionReason: 'x'.repeat(2001) },
      '/rejectionReason',
      'string.too_long',
    ],
    [{ status: 'duplicate' }, '/duplicateOfTicketId', 'field.invalid_type'],
    [{ status: 'done', rejectionReason: 'No' }, '', 'field.unrecognized'],
    [{ status: 'todo', duplicateOfTicketId: ORIGINAL_ID }, '', 'field.unrecognized'],
  ])('rejects %j at %j with %s', (body, pointer, code) => {
    const result = changeTicketStatusSchema.safeParse(body);

    expect(result.success).toBe(false);
    const issue = result.error?.issues[0];
    expect((issue?.path ?? []).map((key) => `/${String(key)}`).join('')).toBe(pointer);
    expect(issue === undefined ? undefined : toFieldErrorCode(issue)).toBe(code);
  });

  it.each([
    { status: 'done' },
    { status: 'waiting_for_requester' },
    { status: 'rejected', rejectionReason: 'x'.repeat(2000) },
    { status: 'duplicate', duplicateOfTicketId: ORIGINAL_ID },
  ])('accepts %j', (body) => {
    expect(changeTicketStatusSchema.safeParse(body).success).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(changeTicketStatusSchema.safeParse({ status: 'closed' }).success).toBe(false);
  });
});

describe('confirmResolutionSchema', () => {
  it.each([
    [{ answer: 'solved' }, true],
    [{ answer: 'not_solved' }, true],
    [{ answer: 'maybe' }, false],
    [{ answer: 'solved', comment: 'Thanks' }, false],
    [{}, false],
  ])('validates %j', (body, isValid) => {
    expect(confirmResolutionSchema.safeParse(body).success).toBe(isValid);
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
    ['ERP-999999999', true],
    ['ERP-1000000000', false],
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
    publicStatus: 'in_progress',
    waitingReason: null,
    duplicateOf: null,
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
      closedAt: null,
      rejectionReason: null,
    };

    expect(ticketResponseSchema.parse(ticket)).toEqual(ticket);
  });

  it("strips every field outside the end user's shape", () => {
    expect(
      ticketResponseSchema.parse({
        ...common,
        source: 'user',
        priority: 'high',
        rejectionReason: 'Internal',
      }),
    ).toEqual(common);
  });
});
