import { createHash } from 'node:crypto';

/** A setup token is valid for 24 hours (§15.6). */
export const SETUP_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1_000;

/** The stored form of a setup token: SHA-256 in base64url. The token itself is never stored. */
export function hashSetupToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

/** When a token issued at `now` expires. */
export function setupTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + SETUP_TOKEN_LIFETIME_MS);
}

/**
 * The setup link printed by `./trybun setup-token` (§15.6). The token is in the fragment, which the
 * browser never sends to a server, so it appears in no access log or `Referer` header.
 */
export function setupLink(domain: string, token: string): string {
  return `https://${domain}/setup#token=${token}`;
}
