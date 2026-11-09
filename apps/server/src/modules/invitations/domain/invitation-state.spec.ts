import { describe, expect, it } from 'vitest';
import { invitationState } from './invitation-state.js';

const NOW = new Date('2026-10-29T12:00:00Z');
const LATER = new Date('2026-10-30T12:00:00Z');
const EARLIER = new Date('2026-10-28T12:00:00Z');

describe('invitationState', () => {
  it.each([
    ['pending', { usedAt: null, revokedAt: null, expiresAt: LATER }],
    ['expired', { usedAt: null, revokedAt: null, expiresAt: EARLIER }],
    ['expired at the instant of expiry', { usedAt: null, revokedAt: null, expiresAt: NOW }],
    ['accepted', { usedAt: EARLIER, revokedAt: null, expiresAt: LATER }],
    ['accepted before it expired', { usedAt: EARLIER, revokedAt: null, expiresAt: EARLIER }],
    ['revoked', { usedAt: null, revokedAt: EARLIER, expiresAt: LATER }],
  ])('%s', (name, timestamps) => {
    expect(invitationState(timestamps, NOW)).toBe(name.split(' ')[0]);
  });
});
