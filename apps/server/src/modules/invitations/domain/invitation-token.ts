import { createHash } from 'node:crypto';
import { INVITATION_VALIDITY_DAYS } from '@trybun/contracts/invitations';

const VALIDITY_MS = INVITATION_VALIDITY_DAYS * 24 * 60 * 60 * 1_000;

/**
 * The stored form of an invitation token: SHA-256 in base64url, like the setup token (ADR 0009).
 * The token itself is never stored.
 */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

/** When a token issued or resent at `now` expires: 7 days later (§7.4, AQ5). */
export function invitationExpiry(now: Date): Date {
  return new Date(now.getTime() + VALIDITY_MS);
}

/**
 * The invitation link (ADR 0009). The token is in the fragment, which the browser never sends to a
 * server, so it appears in no access log or `Referer` header.
 */
export function invitationLink(domain: string, token: string): string {
  return `https://${domain}/invitations#token=${token}`;
}
