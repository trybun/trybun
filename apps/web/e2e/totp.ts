import { createHmac } from 'node:crypto';

/** The TOTP secret of the seeded team accounts of the development realm (docker/keycloak/dev/). */
export const SEEDED_OTP_SECRET = 'trybun-local-2fa-key';

/** The period of the one-time codes of the development realm. */
export const TOTP_PERIOD_MS = 30_000;

/** The current TOTP (RFC 6238, SHA-1, 6 digits, 30 seconds) of a Keycloak OTP secret. */
export function totp(secret: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / TOTP_PERIOD_MS)));
  const hmac = createHmac('sha1', Buffer.from(secret)).update(counter).digest();
  const offset = (hmac.at(-1) ?? 0) & 0x0f;
  return String((hmac.readUInt32BE(offset) & 0x7f_ff_ff_ff) % 1_000_000).padStart(6, '0');
}
