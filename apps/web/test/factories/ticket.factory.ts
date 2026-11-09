import type { Ticket } from '@trybun/contracts/tickets';

/** A ticket response of the API in the team's shape (§3.2) for component tests. */
export function ticketResponse(overrides: Partial<Ticket> = {}): Ticket {
  const project = { id: '0199a3f0-0000-7000-8000-000000000010', key: 'ERP', name: 'ERP system' };
  return {
    id: '0199a3f0-0000-7000-8000-000000000020',
    projectId: project.id,
    project,
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
    assignee: { id: '0199a3f0-0000-7000-8000-000000000031', displayName: 'Anna' },
    closedAt: null,
    rejectionReason: null,
    sharingRefusalReason: null,
    ...overrides,
  };
}

/** A Problem Details body of a refused request (§17.2). */
export function problem(status: number, code: string) {
  return { type: 'about:blank', title: code, status, code };
}
