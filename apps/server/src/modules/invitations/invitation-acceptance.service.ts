import { Inject, Injectable } from '@nestjs/common';
import type {
  AcceptedInvitation,
  AcceptInvitationDto,
  InvitationToAccept,
  VerifyInvitationTokenDto,
} from '@trybun/contracts/invitations';
import type { Language } from '@trybun/contracts/users';
import { isTimeZone } from '@trybun/i18n/time-zones';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenClaims,
  type AccessTokenVerifier,
} from '../../platform/authentication/access-token-verifier.js';
import { isSecondFactorSatisfied } from '../../platform/authentication/second-factor.js';
import { Clock } from '../../platform/clock/clock.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { isUniqueViolation } from '../../platform/database/unique-violation.js';
import { AppError } from '../../platform/errors/app-error.js';
import {
  KEYCLOAK_ADMIN,
  type KeycloakAdmin,
  type KeycloakUserProfile,
} from '../../platform/keycloak-admin/keycloak-admin.js';
import { AuditLogEntriesService } from '../audit-log-entries/audit-log-entries.service.js';
import { hashInvitationToken } from './domain/invitation-token.js';
import { INVITATION } from './invitations.abilities.js';
import { InvitationsService, toTargetDetail } from './invitations.service.js';

const ACCEPTANCE_SELECT = {
  id: true,
  target: true,
  role: true,
  invitedById: true,
  expiresAt: true,
  user: { select: { id: true, email: true, kind: true, state: true, keycloakUserId: true } },
  project: { select: { id: true, key: true, name: true } },
  organization: { select: { id: true, name: true } },
  invitedBy: { select: { displayName: true } },
} satisfies Prisma.InvitationSelect;

type AcceptanceRow = Prisma.InvitationGetPayload<{ select: typeof ACCEPTANCE_SELECT }>;

/** A usable invitation: its account has the address the acceptance locks (ADR 0009). */
type UsableRow = AcceptanceRow & { user: AcceptanceRow['user'] & { email: string } };

/** The Keycloak user an acceptance links to the invited account, with the account settings. */
interface Binding {
  keycloakUserId: string;
  displayName: string | null;
  language: Language;
  timeZone: string | null;
  githubLogin: string | null;
}

function tokenInvalid(): AppError {
  return new AppError('invitation.token_invalid');
}

/** A way of accepting that does not fit the invitation, e.g. a password for a team member. */
function methodNotAllowed(): AppError {
  return new AppError('request.validation_failed', [{ pointer: '/method', code: 'field.invalid' }]);
}

/** The display name of an account: the first and the last name (§7.4). */
function displayNameOf(profile: KeycloakUserProfile): string | null {
  const name = [profile.firstName, profile.lastName]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part !== '')
    .join(' ');
  return name === '' ? null : name;
}

/** The browser's time zone when it is a valid IANA name, else none – the system default (§13.1). */
function timeZoneOf(timeZone: string | undefined): string | null {
  return timeZone !== undefined && isTimeZone(timeZone) ? timeZone : null;
}

/**
 * The acceptance of invitations (ADR 0009, §7.4): checking a link, and accepting it with a
 * password – the API creates the Keycloak user – or with the session of a sign-in through GitHub,
 * Microsoft or Google started from the link, whose Keycloak user the API binds to the account. The
 * claim of the invitation, the activation of the account and the grant of its target are one
 * transaction; only the invitation of the link used is claimed (§7.4).
 */
@Injectable()
export class InvitationAcceptanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(KEYCLOAK_ADMIN) private readonly keycloak: KeycloakAdmin,
    @Inject(ACCESS_TOKEN_VERIFIER) private readonly verifier: AccessTokenVerifier,
    private readonly auditLog: AuditLogEntriesService,
    private readonly invitations: InvitationsService,
  ) {}

  /** What the acceptance page shows for a valid link; any other gets `invitation.token_invalid`. */
  async verifyToken(input: VerifyInvitationTokenDto): Promise<InvitationToAccept> {
    const row = await this.findUsable(hashInvitationToken(input.token));
    return {
      email: row.user.email,
      kind: row.user.kind,
      accountState: row.user.state === 'active' ? 'active' : 'invited',
      target: toTargetDetail(row),
      invitedBy: row.invitedBy,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  /**
   * Accepts an invitation (ADR 0009). The response names the account's kind and where to land: the
   * invited project's home, else the root (AQ4).
   */
  async accept(
    input: AcceptInvitationDto,
    accessToken: string | undefined,
    clientIp: string | undefined,
  ): Promise<AcceptedInvitation> {
    const tokenHash = hashInvitationToken(input.token);
    // Every acceptance goes through the verification, as in the authentication guard; without a
    // JWT it fails as an invalid token. Only the acceptance with a session uses the claims.
    const claims = await this.verifier.verify(accessToken ?? '');
    if (input.method === 'password') {
      return this.acceptWithPassword(input, tokenHash, clientIp);
    }
    if (claims === undefined) {
      throw new AppError('authentication.required');
    }
    return this.acceptWithSession(input, claims, tokenHash, clientIp);
  }

  /**
   * An end user sets the password on the acceptance page (AQ1): the API creates the Keycloak user
   * with the address of the account – whatever the browser sends – and deletes it again when the
   * transaction fails, so a retry starts clean. The password is passed to Keycloak once and never
   * stored or logged.
   */
  private async acceptWithPassword(
    input: Extract<AcceptInvitationDto, { method: 'password' }>,
    tokenHash: string,
    clientIp: string | undefined,
  ): Promise<AcceptedInvitation> {
    const row = await this.findUsable(tokenHash);
    if (row.user.kind !== 'end_user') {
      throw methodNotAllowed();
    }
    // A further link of an active account is accepted only in that account's session (§7.4).
    if (row.user.state !== 'invited' || row.user.keycloakUserId !== null) {
      throw new AppError('invitation.account_mismatch');
    }
    const keycloakUserId = await this.keycloak.createEndUser({
      email: row.user.email,
      firstName: input.firstName,
      lastName: input.lastName,
      password: input.password,
      language: input.language,
    });
    try {
      return await this.complete(row, tokenHash, clientIp, {
        keycloakUserId,
        displayName: displayNameOf(input),
        language: input.language,
        timeZone: timeZoneOf(input.timeZone),
        githubLogin: null,
      });
    } catch (error) {
      await this.keycloak.deleteUser(keycloakUserId);
      throw error;
    }
  }

  /**
   * A sign-in through an identity provider started from the link (ADR 0009): the Keycloak user of
   * the session is bound to the invited account – its address set to the account's (AQ3), and for
   * a team member the GitHub login read and the group `team` joined – or, for a further link of an
   * active account, the session must be that account's (§7.4).
   */
  private async acceptWithSession(
    input: Extract<AcceptInvitationDto, { method: 'identity_provider' }>,
    claims: AccessTokenClaims,
    tokenHash: string,
    clientIp: string | undefined,
  ): Promise<AcceptedInvitation> {
    const row = await this.findUsable(tokenHash);
    const linked = await this.prisma.user.findUnique({
      where: { keycloakUserId: claims.sub },
      select: { id: true, kind: true, state: true },
    });
    if (linked !== null) {
      if (linked.id !== row.user.id || linked.state !== 'active') {
        throw new AppError('invitation.account_mismatch');
      }
      if (!isSecondFactorSatisfied(linked.kind, claims.amr)) {
        throw new AppError('authentication.second_factor_required');
      }
      return this.complete(row, tokenHash, clientIp, null);
    }
    if (row.user.state !== 'invited' || row.user.keycloakUserId !== null) {
      throw new AppError('invitation.account_mismatch');
    }
    const profile = await this.keycloak.findUserProfile(claims.sub);
    if (profile === null) {
      throw new AppError('authentication.required');
    }
    const githubLogin =
      row.user.kind === 'team' ? await this.keycloak.findGithubLogin(claims.sub) : null;
    if (row.user.kind === 'team' && githubLogin === null) {
      // Team members accept with GitHub only (§7.4).
      throw methodNotAllowed();
    }
    await this.keycloak.setVerifiedEmail(claims.sub, row.user.email);
    if (row.user.kind === 'team') {
      // The re-sign-in after the acceptance then requires the 2FA set-up (ADR 0009).
      await this.keycloak.addToTeamGroup(claims.sub);
    }
    return this.complete(row, tokenHash, clientIp, {
      keycloakUserId: claims.sub,
      displayName: displayNameOf(profile),
      language: input.language,
      timeZone: timeZoneOf(input.timeZone),
      githubLogin,
    });
  }

  /**
   * One transaction: claims the invitation with a conditional update – of two simultaneous
   * acceptances only one succeeds – activates the account with its Keycloak user (`binding`, none
   * for an active account), grants the target and records the acceptance with the client IP
   * (§13.5). The project or organization is share-locked first, so an archive that revokes the
   * invitation is either seen by the claim or waits for it (§7.3).
   */
  private async complete(
    row: UsableRow,
    tokenHash: string,
    clientIp: string | undefined,
    binding: Binding | null,
  ): Promise<AcceptedInvitation> {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (!(await this.invitations.lockTarget(tx, row))) {
          throw tokenInvalid();
        }
        const now = this.clock.now();
        const claimed = await tx.invitation.updateMany({
          where: { id: row.id, tokenHash, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (claimed.count === 0) {
          throw tokenInvalid();
        }
        await this.activate(tx, row.user.id, binding);
        await this.invitations.grant(
          tx,
          row.invitedById,
          row.user.id,
          this.invitations.resolvedTargetOf(row, row.user.kind),
          row.target === 'project' ? (row.organization?.id ?? null) : null,
        );
        await this.auditLog.record(tx, {
          action: 'invitation.accepted',
          actorId: row.user.id,
          target: { type: INVITATION, id: row.id },
          ipAddress: clientIp,
          details: { userId: row.user.id },
        });
      });
    } catch (error) {
      // Another acceptance bound this Keycloak user or GitHub account to an account first.
      if (
        isUniqueViolation(error, 'users_keycloak_user_id_key') ||
        isUniqueViolation(error, 'users_github_login_key')
      ) {
        throw new AppError('invitation.account_mismatch');
      }
      throw error;
    }
    return {
      kind: row.user.kind,
      landingPath:
        row.target === 'project' && row.project !== null ? `/projects/${row.project.id}` : '/',
    };
  }

  /**
   * The first acceptance activates the account (`invited` → `active`) with its Keycloak user and
   * settings (§7.4, §13.1); a further one requires it to be active still.
   */
  private async activate(tx: Transaction, userId: string, binding: Binding | null): Promise<void> {
    const { count } =
      binding === null
        ? { count: await tx.user.count({ where: { id: userId, state: 'active' } }) }
        : await tx.user.updateMany({
            where: { id: userId, state: 'invited', keycloakUserId: null },
            data: { ...binding, state: 'active' },
          });
    if (count === 0) {
      throw new AppError('invitation.account_mismatch');
    }
  }

  /**
   * The pending invitation of a token whose account can accept it – `invited`, or `active` for a
   * further link; an unknown, expired, used, revoked or replaced token, and one of a deactivated
   * account, get one error (ADR 0009).
   */
  private async findUsable(tokenHash: string): Promise<UsableRow> {
    const row = await this.prisma.invitation.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: this.clock.now() },
        user: { state: { in: ['invited', 'active'] }, email: { not: null } },
      },
      select: ACCEPTANCE_SELECT,
    });
    if (row === null || row.user.email === null) {
      throw tokenInvalid();
    }
    return { ...row, user: { ...row.user, email: row.user.email } };
  }
}
