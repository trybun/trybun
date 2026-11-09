import type { TicketStatus } from '@trybun/contracts/tickets';
import type { StatusFields } from './status-transitions.js';

/**
 * The status a public comment of the ticket's requester leads to (§4.3, S1-12 Q10), or `null`
 * when it changes nothing. Only a comment of the requester's end-user account counts – the team
 * and other end users can always comment without moving the ticket:
 * - waiting for the confirmation of the resolution → `in_progress`, as "No, still a problem";
 * - waiting for information → the status before waiting;
 * - `done` → `triage`, a reopen. The abilities refuse the comment 14 days after the close
 *   (`ticket.comments_closed`), and on `rejected` and `duplicate`, before this rule runs.
 */
export function requesterReplyTarget(
  ticket: Pick<StatusFields, 'status' | 'waitingReason' | 'statusBeforeWaiting'>,
  isPublicCommentOfRequester: boolean,
): TicketStatus | null {
  if (!isPublicCommentOfRequester) {
    return null;
  }
  if (ticket.status === 'waiting_for_requester') {
    return ticket.waitingReason === 'confirmation'
      ? 'in_progress'
      : (ticket.statusBeforeWaiting ?? 'triage');
  }
  return ticket.status === 'done' ? 'triage' : null;
}
