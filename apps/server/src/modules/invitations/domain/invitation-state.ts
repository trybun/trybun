import type { InvitationState } from '@trybun/contracts/invitations';

/** The timestamps an invitation's state is derived from (§7.4). */
export interface InvitationTimestamps {
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}

/**
 * The state of an invitation (§7.4), never stored so it cannot disagree with its timestamps: an
 * acceptance or a revocation is final, otherwise it is pending until it expires.
 */
export function invitationState(invitation: InvitationTimestamps, now: Date): InvitationState {
  if (invitation.usedAt !== null) {
    return 'accepted';
  }
  if (invitation.revokedAt !== null) {
    return 'revoked';
  }
  return invitation.expiresAt > now ? 'pending' : 'expired';
}
