import { describe, expect, it } from 'vitest';
import { toFieldErrorCode } from '../problem-details/index.js';
import {
  changeTicketStatusSchema,
  confirmResolutionSchema,
  createTicketSchema,
  isTerminalStatus,
  publicStatusDescriptionOf,
  publicStatusDescriptionSchema,
  publicStatusOf,
  resolutionAnswerSchema,
  listTicketsQuerySchema,
  TICKET_TYPE_DEFAULT_PRIORITY,
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

describe('TICKET_TYPE_DEFAULT_PRIORITY', () => {
  it('proposes low for a question and normal for every other type (§3.4)', () => {
    expect(TICKET_TYPE_DEFAULT_PRIORITY).toEqual({
      bug: 'normal',
      feature: 'normal',
      task: 'normal',
      question: 'low',
    });
  });
});

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
        'add_attachment',
      ],
    ],
    [ticketWaitingReasonSchema, ['information', 'confirmation']],
    [ticketPublicStatusSchema, ['received', 'awaiting_reply', 'in_progress', 'resolved', 'closed']],
    [resolutionAnswerSchema, ['solved', 'not_solved']],
    [
      publicStatusDescriptionSchema,
      [
        'received',
        'analyzing',
        'information_needed',
        'confirmation_needed',
        'scheduled',
        'working',
        'testing',
        'resolved',
        'rejected',
        'merged',
      ],
    ],
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

describe('public status description', () => {
  /** One row of §4.2 per status and waiting reason; a reason outside waiting changes nothing. */
  const DESCRIPTIONS = {
    new: { none: 'received', information: 'received', confirmation: 'received' },
    triage: { none: 'analyzing', information: 'analyzing', confirmation: 'analyzing' },
    todo: { none: 'scheduled', information: 'scheduled', confirmation: 'scheduled' },
    in_progress: { none: 'working', information: 'working', confirmation: 'working' },
    in_verification: { none: 'testing', information: 'testing', confirmation: 'testing' },
    waiting_for_requester: {
      none: 'information_needed',
      information: 'information_needed',
      confirmation: 'confirmation_needed',
    },
    done: { none: 'resolved', information: 'resolved', confirmation: 'resolved' },
    rejected: { none: 'rejected', information: 'rejected', confirmation: 'rejected' },
    duplicate: { none: 'merged', information: 'merged', confirmation: 'merged' },
  } as const;

  const combinations = ticketStatusSchema.options.flatMap((status) =>
    [null, ...ticketWaitingReasonSchema.options].map(
      (reason) => [status, reason, DESCRIPTIONS[status][reason ?? 'none']] as const,
    ),
  );

  it.each(combinations)('describes %s with the reason %s as %s', (status, reason, description) => {
    expect(publicStatusDescriptionOf(status, reason)).toBe(description);
  });

  it('uses every description, each within one public status', () => {
    const publicStatuses = new Map<string, Set<string>>();
    for (const [status, , description] of combinations) {
      publicStatuses.set(
        description,
        (publicStatuses.get(description) ?? new Set()).add(publicStatusOf(status)),
      );
    }
    expect([...publicStatuses.keys()].sort()).toEqual(
      [...publicStatusDescriptionSchema.options].sort(),
    );
    for (const statuses of publicStatuses.values()) {
      expect(statuses.size).toBe(1);
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

  it.each([
    [[], true],
    [Array<string>(100).fill(PROJECT_ID), true],
    [Array<string>(101).fill(PROJECT_ID), false],
    [['x'], false],
  ])('limits the attachments to 100 IDs (%#)', (attachmentIds, isValid) => {
    expect(
      createTicketSchema.safeParse({ projectId: PROJECT_ID, title: 'T', attachmentIds }).success,
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

describe('listTicketsQuerySchema', () => {
  it('lists the tickets the principal requested with involvement=mine', () => {
    expect(listTicketsQuerySchema.parse({ involvement: 'mine', projectId: PROJECT_ID })).toEqual({
      involvement: 'mine',
      projectId: PROJECT_ID,
      limit: 50,
    });
  });

  it.each([
    [{ involvement: 'watched' }, '/involvement', 'field.invalid_value'],
    [{ involvement: 'mine', identifier: 'ERP-1' }, '/identifier', 'field.invalid'],
  ])('rejects %j at %s with %s', (query, pointer, code) => {
    const result = listTicketsQuerySchema.safeParse(query);

    expect(result.success).toBe(false);
    const issue = result.error?.issues[0];
    expect((issue?.path ?? []).map((key) => `/${String(key)}`).join('')).toBe(pointer);
    expect(issue === undefined ? undefined : toFieldErrorCode(issue)).toBe(code);
  });
});

describe('ticketResponseSchema', () => {
  const common = {
    id: PROJECT_ID,
    projectId: PROJECT_ID,
    project: { id: PROJECT_ID, key: 'ERP', name: 'ERP system' },
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
    const endUserTicket = { ...common, publicStatusDescription: 'testing' };

    expect(
      ticketResponseSchema.parse({
        ...endUserTicket,
        source: 'user',
        priority: 'high',
        status: 'in_verification',
        rejectionReason: 'Internal',
      }),
    ).toEqual(endUserTicket);
  });
});
