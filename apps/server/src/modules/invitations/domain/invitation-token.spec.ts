import { describe, expect, it } from 'vitest';
import { hashInvitationToken, invitationExpiry, invitationLink } from './invitation-token.js';

describe('invitation token', () => {
  it('hashes with SHA-256 in base64url', () => {
    expect(hashInvitationToken('token')).toBe('PEaenWxYddN6Q_NT1PiOYfz4EsZu7jRXRlpAsNpBU-A');
  });

  it('expires 7 days after it was issued or resent', () => {
    expect(invitationExpiry(new Date('2026-10-29T12:00:00Z'))).toEqual(
      new Date('2026-11-05T12:00:00Z'),
    );
  });

  it('carries the token in the fragment of the link', () => {
    expect(invitationLink('trybun.example.com', 'abc')).toBe(
      'https://trybun.example.com/invitations#token=abc',
    );
  });
});
