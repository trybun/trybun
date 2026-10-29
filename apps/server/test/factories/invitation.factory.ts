import { createHash, randomBytes } from 'node:crypto';
import type { Invitation, Prisma } from '../../src/generated/prisma/client.js';
import type { Transaction } from '../../src/platform/database/prisma.service.js';

/** A token of an invitation link and its stored hash (ADR 0009). */
export function buildInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: createHash('sha256').update(token).digest('base64url') };
}

/**
 * A pending invitation of an account, valid 7 days; the target defaults to the Administrator role,
 * which needs no project or organization.
 */
export function createInvitation(
  db: Transaction,
  invitation: Omit<Prisma.InvitationUncheckedCreateInput, 'tokenHash' | 'expiresAt' | 'target'> &
    Partial<Pick<Prisma.InvitationUncheckedCreateInput, 'tokenHash' | 'expiresAt' | 'target'>>,
): Promise<Invitation> {
  return db.invitation.create({
    data: {
      target: 'administrator',
      tokenHash: buildInvitationToken().tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ...invitation,
    },
  });
}
