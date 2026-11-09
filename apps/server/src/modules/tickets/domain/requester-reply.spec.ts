import type { TicketStatus, TicketWaitingReason } from '@trybun/contracts/tickets';
import { describe, expect, it } from 'vitest';
import { requesterReplyTarget } from './requester-reply.js';

function ticket(
  status: TicketStatus,
  waitingReason: TicketWaitingReason | null = null,
  statusBeforeWaiting: TicketStatus | null = null,
) {
  return { status, waitingReason, statusBeforeWaiting };
}

// The rows of the requester-reply rules (§4.3, S1-12).
describe('requesterReplyTarget', () => {
  it.each([
    [
      'waiting for the confirmation',
      ticket('waiting_for_requester', 'confirmation', 'in_verification'),
      'in_progress',
    ],
    ['waiting for information', ticket('waiting_for_requester', 'information', 'todo'), 'todo'],
    ['waiting after a reopen', ticket('waiting_for_requester', 'information', 'triage'), 'triage'],
    ['done', ticket('done'), 'triage'],
    ['in progress', ticket('in_progress'), null],
    ['new', ticket('new'), null],
    ['in triage', ticket('triage'), null],
  ] as const)('moves a ticket %s to %s', (_case, row, target) => {
    expect(requesterReplyTarget(row, true)).toBe(target);
  });

  it.each([ticket('waiting_for_requester', 'confirmation'), ticket('done')])(
    'changes nothing for a comment of someone else or a note (Q10)',
    (row) => {
      expect(requesterReplyTarget(row, false)).toBeNull();
    },
  );
});
