import type { ActivityEventTicketSnapshot } from '@trybun/contracts/activity-events';
import { describe, expect, it } from 'vitest';
import {
  answerTarget,
  automaticCloseDueAt,
  changeStatus,
  type StatusChangeRequest,
  type StatusTicket,
  waitsForConfirmation,
} from './status-transitions.js';

const NOW = new Date('2026-11-05T10:00:00.000Z');
const EARLIER = new Date('2026-11-01T08:00:00.000Z');
const ORIGINAL: ActivityEventTicketSnapshot = {
  id: '0190f2f4-7c1e-7000-8000-000000000001',
  number: 3,
  projectKey: 'ERP',
};
const OTHER_ORIGINAL: ActivityEventTicketSnapshot = {
  id: '0190f2f4-7c1e-7000-8000-000000000002',
  number: 4,
  projectKey: 'ERP',
};

function ticket(overrides: Partial<StatusTicket> = {}): StatusTicket {
  return {
    status: 'in_progress',
    source: 'developer',
    waitingReason: null,
    statusBeforeWaiting: null,
    waitingSince: null,
    closedAt: null,
    ...overrides,
  };
}

const waiting = (reason: 'information' | 'confirmation', overrides: Partial<StatusTicket> = {}) =>
  ticket({
    status: 'waiting_for_requester',
    source: 'user',
    waitingReason: reason,
    statusBeforeWaiting: 'in_verification',
    waitingSince: EARLIER,
    ...overrides,
  });

const closed = (status: 'done' | 'rejected' | 'duplicate', overrides: Partial<StatusTicket> = {}) =>
  ticket({
    status,
    closedAt: EARLIER,
    ...overrides,
  });

function request(overrides: Partial<StatusChangeRequest> = {}): StatusChangeRequest {
  return {
    target: 'done',
    currentOriginal: null,
    confirmResolution: false,
    now: NOW,
    ...overrides,
  };
}

describe('changeStatus', () => {
  describe('the current status', () => {
    it.each([
      ['todo', ticket({ status: 'todo' })],
      ['done', closed('done')],
      ['waiting for information', waiting('information')],
    ])('changes nothing for %s (Q16)', (_case, current) => {
      expect(
        changeStatus(current, request({ target: current.status, confirmResolution: true })),
      ).toEqual({
        fields: null,
        relation: { kind: 'keep' },
        events: [],
        statusChanged: null,
        reopen: false,
      });
    });

    it('changes no field for a repeated rejection: its reason is a comment (S1-12)', () => {
      const change = changeStatus(closed('rejected'), request({ target: 'rejected' }));

      expect(change.fields).toBeNull();
      expect(change.events).toEqual([]);
      expect(change.statusChanged).toBeNull();
    });

    it('re-points a duplicate to a new original without new status fields (Q16)', () => {
      const change = changeStatus(
        closed('duplicate'),
        request({ target: 'duplicate', original: OTHER_ORIGINAL, currentOriginal: ORIGINAL }),
      );

      expect(change.fields).toBeNull();
      expect(change.relation).toEqual({ kind: 'set', original: OTHER_ORIGINAL });
      expect(change.events).toEqual([
        {
          type: 'duplicate_original_changed',
          data: { from: ORIGINAL, to: OTHER_ORIGINAL },
          isPublic: false,
        },
      ]);
    });

    it('changes nothing for a duplicate of the same original', () => {
      expect(
        changeStatus(
          closed('duplicate'),
          request({ target: 'duplicate', original: ORIGINAL, currentOriginal: ORIGINAL }),
        ).relation,
      ).toEqual({ kind: 'keep' });
    });
  });

  describe('rejecting and duplicates', () => {
    it('closes a rejected ticket; its reason is a comment of the service (S1-12)', () => {
      const change = changeStatus(ticket(), request({ target: 'rejected' }));

      expect(change.fields).toEqual({
        status: 'rejected',
        waitingReason: null,
        statusBeforeWaiting: null,
        waitingSince: null,
        closedAt: NOW,
      });
      expect(change.events).toEqual([
        {
          type: 'status_changed',
          data: {
            from: 'in_progress',
            to: 'rejected',
            reopen: false,
            waitingReason: null,
            duplicateOf: null,
          },
          isPublic: true,
        },
      ]);
    });

    it('links a new duplicate to its original', () => {
      const change = changeStatus(ticket(), request({ target: 'duplicate', original: ORIGINAL }));

      expect(change.relation).toEqual({ kind: 'set', original: ORIGINAL });
      expect(change.events[0]?.data).toMatchObject({ to: 'duplicate', duplicateOf: ORIGINAL });
      expect(change.fields?.closedAt).toEqual(NOW);
    });

    it('clears the reason when the ticket leaves rejected', () => {
      expect(changeStatus(closed('rejected'), request({ target: 'todo' })).fields).toMatchObject({
        status: 'todo',
        closedAt: null,
      });
    });

    it('removes the link when the ticket leaves duplicate, with an event', () => {
      const change = changeStatus(
        closed('duplicate'),
        request({ target: 'triage', currentOriginal: ORIGINAL }),
      );

      expect(change.relation).toEqual({ kind: 'remove' });
      expect(change.events.map((event) => event.type)).toEqual([
        'status_changed',
        'duplicate_link_removed',
      ]);
      expect(change.events[1]).toEqual({
        type: 'duplicate_link_removed',
        data: { from: ORIGINAL, to: null },
        isPublic: false,
      });
    });

    it('removes the link when a duplicate moves to another terminal status', () => {
      expect(
        changeStatus(closed('duplicate'), request({ target: 'done', currentOriginal: ORIGINAL }))
          .relation,
      ).toEqual({ kind: 'remove' });
    });
  });

  describe('waiting', () => {
    it('waits for information after a move of the team, with the status before waiting (Q4)', () => {
      const change = changeStatus(ticket(), request({ target: 'waiting_for_requester' }));

      expect(change.fields).toEqual({
        status: 'waiting_for_requester',
        waitingReason: 'information',
        statusBeforeWaiting: 'in_progress',
        waitingSince: NOW,
        closedAt: null,
      });
      expect(change.statusChanged).toEqual({
        from: 'in_progress',
        to: 'waiting_for_requester',
        waitingReason: 'information',
        reopen: false,
      });
    });

    it('switches a wait for confirmation to information and restarts it', () => {
      const change = changeStatus(
        waiting('confirmation'),
        request({ target: 'waiting_for_requester' }),
      );

      expect(change.fields).toMatchObject({
        waitingReason: 'information',
        statusBeforeWaiting: 'in_verification',
        waitingSince: NOW,
      });
      expect(change.events).toEqual([
        {
          type: 'status_changed',
          data: {
            from: 'waiting_for_requester',
            to: 'waiting_for_requester',
            reopen: false,
            waitingReason: 'information',
            duplicateOf: null,
          },
          // The public status stays `awaiting_reply` (Q21).
          isPublic: false,
        },
      ]);
    });

    it('stores triage as the status before waiting after a reopen into waiting (Q20)', () => {
      const change = changeStatus(closed('done'), request({ target: 'waiting_for_requester' }));

      expect(change.fields).toMatchObject({
        statusBeforeWaiting: 'triage',
        closedAt: null,
      });
      expect(change.reopen).toBe(true);
    });

    it('clears the waiting fields when the ticket leaves waiting', () => {
      expect(
        changeStatus(waiting('information'), request({ target: 'in_progress' })).fields,
      ).toEqual({
        status: 'in_progress',
        waitingReason: null,
        statusBeforeWaiting: null,
        waitingSince: null,
        closedAt: null,
      });
    });
  });

  describe('resolution confirmation', () => {
    it('asks the requester of a user ticket instead of closing it', () => {
      const change = changeStatus(
        ticket({ source: 'user', status: 'in_verification' }),
        request({ target: 'done', confirmResolution: true }),
      );

      expect(change.fields).toMatchObject({
        status: 'waiting_for_requester',
        waitingReason: 'confirmation',
        statusBeforeWaiting: 'in_verification',
        waitingSince: NOW,
        closedAt: null,
      });
      expect(change.statusChanged?.waitingReason).toBe('confirmation');
    });

    it('switches a wait for information to confirmation', () => {
      const change = changeStatus(
        waiting('information'),
        request({ target: 'done', confirmResolution: true }),
      );

      expect(change.fields).toMatchObject({
        status: 'waiting_for_requester',
        waitingReason: 'confirmation',
        statusBeforeWaiting: 'in_verification',
        waitingSince: NOW,
      });
      expect(change.events[0]?.isPublic).toBe(false);
    });

    it.each([
      ['the setting is off', ticket({ source: 'user' }), false],
      ['the ticket comes from the team', ticket({ source: 'developer' }), true],
      ['the ticket comes from an integration', ticket({ source: 'integration' }), true],
      ['the ticket is terminal', closed('rejected', { source: 'user' }), true],
      ['the ticket waits for the confirmation already (Q5)', waiting('confirmation'), true],
    ])('closes directly when %s', (_case, current, confirmResolution) => {
      expect(
        changeStatus(current, request({ target: 'done', confirmResolution })).fields,
      ).toMatchObject({ status: 'done', closedAt: NOW, waitingReason: null });
    });
  });

  describe('reopening and closing', () => {
    it.each(['done', 'rejected', 'duplicate'] as const)(
      'reopens a %s ticket moved to an open status (Q6)',
      (status) => {
        const change = changeStatus(
          closed(status),
          request({ target: 'in_progress', currentOriginal: ORIGINAL }),
        );

        expect(change.reopen).toBe(true);
        expect(change.fields?.closedAt).toBeNull();
        expect(change.events[0]?.data).toMatchObject({ reopen: true });
        expect(change.statusChanged?.reopen).toBe(true);
      },
    );

    it('sets the closing time anew from one terminal status to another without a reopen (Q6)', () => {
      const change = changeStatus(closed('done'), request({ target: 'rejected' }));

      expect(change.reopen).toBe(false);
      expect(change.fields).toMatchObject({ closedAt: NOW });
      // `resolved` → `closed` is a public change (§4.5).
      expect(change.events[0]?.isPublic).toBe(true);
    });

    it('records an internal event when the public status stays (§4.5)', () => {
      expect(
        changeStatus(ticket({ status: 'todo' }), request({ target: 'in_progress' })).events,
      ).toMatchObject([{ type: 'status_changed', isPublic: false }]);
    });
  });
});

describe('resolution answers', () => {
  it.each([
    ['solved', 'done'],
    ['not_solved', 'in_progress'],
  ] as const)('moves the ticket for %s to %s', (answer, status) => {
    expect(answerTarget(answer)).toBe(status);
  });

  it('closes an answered ticket directly, without asking again', () => {
    expect(
      changeStatus(
        waiting('confirmation'),
        request({ target: answerTarget('solved'), confirmResolution: true }),
      ).fields?.status,
    ).toBe('done');
  });

  it.each([
    [waiting('confirmation'), true],
    [waiting('information'), false],
    [ticket(), false],
  ])('knows whether the ticket waits for confirmation', (current, expected) => {
    expect(waitsForConfirmation(current)).toBe(expected);
  });

  it('closes 7 × 24 hours after the request (Q7)', () => {
    expect(automaticCloseDueAt(EARLIER)).toEqual(new Date('2026-11-08T08:00:00.000Z'));
  });
});
