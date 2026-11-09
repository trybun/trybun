import { describe, expect, it } from 'vitest';
import { ticketStatusChangedPayloadSchema } from './tickets.events.js';

const ID = '0190f2f4-7c1e-7000-8000-000000000001';

// Payload compatibility (§17.2, §18.7): a payload of an earlier release still parses.
describe('ticketStatusChangedPayloadSchema', () => {
  const previous = {
    ticketId: ID,
    projectId: ID,
    from: 'waiting_for_requester',
    to: 'in_progress',
    fromPublic: 'awaiting_reply',
    toPublic: 'in_progress',
    waitingReason: null,
    reopen: false,
    actorId: ID,
  };

  it('parses the payload of S1-06, without the comment (S1-12 Q15)', () => {
    expect(ticketStatusChangedPayloadSchema.parse(previous)).toEqual(previous);
  });

  it('keeps the comment that caused the change', () => {
    expect(ticketStatusChangedPayloadSchema.parse({ ...previous, commentId: ID })).toMatchObject({
      commentId: ID,
    });
  });
});
