import { randomBytes } from 'node:crypto';
import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { Inject, Injectable } from '@nestjs/common';
import {
  type CreatedInvitation,
  type CreateInvitationInput,
  type Invitation,
  type InvitationAction,
  type InvitationPage,
  type InvitationPreview,
  type InvitationState,
  type InvitationTarget,
  type InvitationTargetDetail,
  type ListInvitationsQuery,
  type ResentInvitation,
} from '@trybun/contracts/invitations';
import type { ProjectMemberRole } from '@trybun/contracts/projects';
import type { UserKind } from '@trybun/contracts/users';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import {
  AbilityFactory,
  type AppAbility,
  type InvitationRuleRecord,
} from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import { Clock } from '../../platform/clock/clock.js';
import { TRYBUN_CONFIG } from '../../platform/config/config.module.js';
import type { TrybunConfig } from '../../platform/config/config.schema.js';
import { decodeCursor, toPage } from '../../platform/database/cursor.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { isUniqueViolation } from '../../platform/database/unique-violation.js';
import { AppError } from '../../platform/errors/app-error.js';
import { OutboxService } from '../../platform/outbox/outbox.service.js';
import { AuditLogEntriesService } from '../audit-log-entries/audit-log-entries.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { invitationState } from './domain/invitation-state.js';
import {
  hashInvitationToken,
  invitationExpiry,
  invitationLink,
} from './domain/invitation-token.js';
import { pendingInvitationWhere } from './invitation-revocations.service.js';
import { CREATE, INVITATION } from './invitations.abilities.js';

/** The fields of an invitation response and of its rules: the principal's own membership. */
function invitationSelect(principal: UserPrincipal) {
  return {
    id: true,
    target: true,
    role: true,
    userId: true,
    expiresAt: true,
    usedAt: true,
    revokedAt: true,
    createdAt: true,
    user: { select: { id: true, email: true, displayName: true, kind: true } },
    project: {
      select: {
        id: true,
        key: true,
        name: true,
        state: true,
        members: { where: { userId: principal.userId }, select: { userId: true, role: true } },
      },
    },
    organization: { select: { id: true, name: true, state: true } },
    invitedBy: { select: { id: true, displayName: true } },
  } satisfies Prisma.InvitationSelect;
}

export type InvitationRow = Prisma.InvitationGetPayload<{
  select: ReturnType<typeof invitationSelect>;
}>;

/** The fields of an invitation that describe its target. */
export interface TargetRow {
  id: string;
  target: InvitationRow['target'];
  role: InvitationRow['role'];
  project: { id: string; key: string; name: string } | null;
  organization: { id: string; name: string } | null;
}

/** The target of an invitation row with the names of its project and organization. */
export function toTargetDetail(row: TargetRow): InvitationTargetDetail {
  switch (row.target) {
    case 'project':
      if (row.project === null || row.role === null) {
        throw new Error(`Invitation ${row.id}: a project target without its project and role`);
      }
      return {
        type: 'project',
        project: { id: row.project.id, key: row.project.key, name: row.project.name },
        role: row.role,
        organization:
          row.organization === null
            ? null
            : { id: row.organization.id, name: row.organization.name },
      };
    case 'organization':
      if (row.organization === null) {
        throw new Error(`Invitation ${row.id}: an organization target without its organization`);
      }
      return {
        type: 'organization',
        organization: { id: row.organization.id, name: row.organization.name },
      };
    case 'administrator':
      return { type: 'administrator' };
  }
}

/** The fields of an invitation its rules read: the principal's membership of its project. */
interface RuleRow {
  target: InvitationRow['target'];
  project: { members: { userId: string; role: string }[] } | null;
}

/** The invitation as its rules read it (§18.3). */
function ruleRecord(row: RuleRow) {
  return subject(INVITATION, {
    target: row.target,
    project: row.project === null ? null : { members: row.project.members },
  } satisfies InvitationRuleRecord);
}

/** Whether the target of an invitation is archived, so it is read-only (§7.3). */
function isTargetArchived(row: InvitationRow): boolean {
  return (
    row.project?.state === 'archived' ||
    (row.target === 'organization' && row.organization?.state === 'archived')
  );
}

/** The states in which an action of an invitation applies (§7.4). */
const STATES_OF_ACTIONS: Record<InvitationAction, readonly InvitationState[]> = {
  resend: ['pending', 'expired'],
  revoke: ['pending'],
};

/** The response shape of an invitation (§18.3), never with the token or its hash. */
function toInvitationResponse(row: InvitationRow, ability: AppAbility, now: Date): Invitation {
  const state = invitationState(row, now);
  const record = ruleRecord(row);
  return {
    id: row.id,
    user: { id: row.user.id, email: row.user.email, displayName: row.user.displayName },
    target: toTargetDetail(row),
    invitedBy: row.invitedBy,
    state,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    allowedActions: (['resend', 'revoke'] as const).filter(
      (action) =>
        STATES_OF_ACTIONS[action].includes(state) &&
        !isTargetArchived(row) &&
        ability.can(action, record),
    ),
  };
}

/** The `where` of the invitations in a state at `now`, derived from their timestamps (§7.4). */
function stateWhere(state: InvitationState, now: Date): Prisma.InvitationWhereInput {
  switch (state) {
    case 'pending':
      return pendingInvitationWhere(now);
    case 'accepted':
      return { usedAt: { not: null } };
    case 'revoked':
      return { usedAt: null, revokedAt: { not: null } };
    case 'expired':
      return { usedAt: null, revokedAt: null, expiresAt: { lte: now } };
  }
}

/** Invitations are sorted newest first: by creation time, then ID. */
const invitationSortKeySchema = z.tuple([z.iso.datetime(), z.uuid()]);

/** The target of a new invitation, resolved and authorized, with the kind of account it needs. */
export type ResolvedTarget =
  | {
      type: 'project';
      project: { id: string; key: string; name: string };
      role: ProjectMemberRole;
      kind: UserKind;
    }
  | { type: 'organization'; organization: { id: string; name: string }; kind: 'end_user' }
  | { type: 'administrator'; kind: 'team' };

/** The organization an invitation names. */
interface NamedOrganization {
  id: string;
  name: string;
}

/** What issuing an invitation to an address does (§7.4). */
type Outcome =
  | { type: 'new_account'; organization: NamedOrganization | null }
  | { type: 'further_invitation'; userId: string }
  | { type: 'grant'; user: { id: string; displayName: string | null } };

/** A new token of an invitation link; only its hash is stored (ADR 0009). */
function newToken(now: Date): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token), expiresAt: invitationExpiry(now) };
}

/** The result of issuing: a new invitation (`201`) or the access granted directly (`200`). */
export interface IssuedInvitation {
  created: CreatedInvitation;
  isNew: boolean;
}

/**
 * Issuing invitations (§7.4): the preview, the issue with a direct grant to an active account,
 * the list, resending and revoking. Each use case is one transaction (§18.3). The acceptance is
 * `InvitationAcceptanceService`.
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
    private readonly clock: Clock,
    @Inject(TRYBUN_CONFIG) private readonly config: TrybunConfig,
    private readonly auditLog: AuditLogEntriesService,
    private readonly outbox: OutboxService,
    private readonly projects: ProjectsService,
    private readonly organizations: OrganizationsService,
  ) {}

  /**
   * What issuing would do, asked before sending (§7.4): a new invitation with the organization the
   * person will join by their e-mail domain, or the access granted directly. A refusal is the
   * error the issue would return. Writes nothing.
   */
  async preview(
    principal: UserPrincipal,
    input: CreateInvitationInput,
  ): Promise<InvitationPreview> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      const target = await this.resolveTarget(tx, ability, principal, input.target);
      const outcome = await this.decide(tx, input.email, target);
      return {
        outcome: outcome.type === 'grant' ? 'grant' : 'invite',
        organization: outcome.type === 'new_account' ? outcome.organization : null,
      };
    });
  }

  /**
   * Issues an invitation (§7.4): to a new address with a new account in state `invited`, to an
   * `invited` account as a further invitation, or grants the access directly to an active
   * account. Two concurrent invitations of one new address create one account: the second meets
   * its unique address and is issued again as a further invitation of that account.
   */
  async create(principal: UserPrincipal, input: CreateInvitationInput): Promise<IssuedInvitation> {
    try {
      return await this.issue(principal, input);
    } catch (error) {
      if (isUniqueViolation(error, 'users_email_key')) {
        return this.issue(principal, input);
      }
      throw error;
    }
  }

  /** The invitations the principal may see, newest first; pending ones by default. */
  async list(principal: UserPrincipal, query: ListInvitationsQuery): Promise<InvitationPage> {
    const ability = this.abilities.forPrincipal(principal);
    if (!ability.can('read', INVITATION)) {
      throw new AppError('request.not_found');
    }
    const now = this.clock.now();
    const after = decodeCursor(query.cursor, invitationSortKeySchema);
    const rows = await this.prisma.invitation.findMany({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType(INVITATION),
          stateWhere(query.state, now),
          {
            projectId: query.projectId,
            organizationId: query.organizationId,
            userId: query.userId,
          },
          after === null
            ? {}
            : {
                OR: [
                  { createdAt: { lt: new Date(after[0]) } },
                  { createdAt: new Date(after[0]), id: { lt: after[1] } },
                ],
              },
        ],
      },
      select: invitationSelect(principal),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return toPage(
      rows,
      query.limit,
      (row) => toInvitationResponse(row, ability, now),
      (row) => [row.createdAt.toISOString(), row.id],
    );
  }

  /**
   * Replaces the token of a pending or expired invitation (§7.4): the old link stops working and
   * the new one is valid for 7 days from now (AQ5). The new link is returned only here.
   */
  async resend(principal: UserPrincipal, invitationId: string): Promise<ResentInvitation> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      const row = await this.findVisible(tx, ability, principal, invitationId, 'resend');
      if (row.target !== 'organization' && row.user.kind === 'team') {
        this.assertGithubSignInConfigured();
      }
      const now = this.clock.now();
      const { token, tokenHash, expiresAt } = newToken(now);
      const { count } = await tx.invitation.updateMany({
        where: { id: invitationId, usedAt: null, revokedAt: null },
        data: { tokenHash, expiresAt },
      });
      if (count === 0) {
        throw new AppError('invitation.not_pending');
      }
      await this.auditLog.record(tx, {
        action: 'invitation.resent',
        actorId: principal.userId,
        target: { type: INVITATION, id: invitationId },
        details: { userId: row.userId },
      });
      return {
        invitation: toInvitationResponse(
          await this.findVisible(tx, ability, principal, invitationId),
          ability,
          now,
        ),
        link: invitationLink(this.config.domain, token),
      };
    });
  }

  /** Revokes a pending invitation (§7.4); its link stops working. */
  async revoke(principal: UserPrincipal, invitationId: string): Promise<void> {
    const ability = this.abilities.forPrincipal(principal);
    await this.prisma.$transaction(async (tx) => {
      const row = await this.findVisible(tx, ability, principal, invitationId, 'revoke');
      const now = this.clock.now();
      const { count } = await tx.invitation.updateMany({
        where: { id: invitationId, ...stateWhere('pending', now) },
        data: { revokedAt: now },
      });
      if (count === 0) {
        throw new AppError('invitation.not_pending');
      }
      await this.auditLog.record(tx, {
        action: 'invitation.revoked',
        actorId: principal.userId,
        target: { type: INVITATION, id: invitationId },
        details: { userId: row.userId, reason: 'revoked' },
      });
    });
  }

  /**
   * Gives an active account the target of an invitation (§7.4), through the services that own the
   * access: project membership, organization membership, the Administrator flag. The caller holds
   * the share lock of the project or organization. On acceptance, `matchedOrganizationId` is the
   * organization matched by the e-mail domain when the invitation was issued (§7.3): it is joined
   * only while it is active and still has the project, otherwise the account gets personal access.
   * Access the account has already is kept as it is.
   */
  async grant(
    tx: Transaction,
    actorId: string | null,
    userId: string,
    target: ResolvedTarget,
    matchedOrganizationId: string | null = null,
  ): Promise<void> {
    switch (target.type) {
      case 'project':
        if (
          matchedOrganizationId !== null &&
          (await this.joinMatchedOrganization(
            tx,
            actorId,
            userId,
            matchedOrganizationId,
            target.project.id,
          ))
        ) {
          return;
        }
        await this.projects.addMembership(tx, actorId, target.project.id, userId, target.role);
        return;
      case 'organization':
        await this.organizations.addMembership(tx, actorId, target.organization.id, userId);
        return;
      case 'administrator': {
        // The Administrator flag of the `users` module, set here in the transaction of the
        // invitation (the users module has no use case for it yet).
        const { count } = await tx.user.updateMany({
          where: { id: userId, kind: 'team', isAdmin: false },
          data: { isAdmin: true },
        });
        if (count > 0) {
          await this.auditLog.record(tx, {
            action: 'user.admin_granted',
            actorId,
            target: { type: 'User', id: userId },
          });
        }
        return;
      }
    }
  }

  /**
   * Locks the project or organization of a target in share mode for the rest of the transaction,
   * so a concurrent archive waits or is seen (§7.3); `false` when it no longer exists.
   */
  lockTarget(tx: Transaction, row: TargetRow): Promise<boolean> {
    if (row.target === 'project' && row.project !== null) {
      return this.projects.lockForShare(tx, row.project.id);
    }
    if (row.target === 'organization' && row.organization !== null) {
      return this.organizations.lockForShare(tx, row.organization.id);
    }
    return Promise.resolve(true);
  }

  /** The target of an invitation row as the grant takes it. */
  resolvedTargetOf(row: TargetRow, kind: UserKind): ResolvedTarget {
    const detail = toTargetDetail(row);
    switch (detail.type) {
      case 'project':
        return {
          type: 'project',
          project: detail.project,
          role: detail.role,
          kind,
        };
      case 'organization':
        return { type: 'organization', organization: detail.organization, kind: 'end_user' };
      case 'administrator':
        return { type: 'administrator', kind: 'team' };
    }
  }

  private async issue(
    principal: UserPrincipal,
    input: CreateInvitationInput,
  ): Promise<IssuedInvitation> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      const target = await this.resolveTarget(tx, ability, principal, input.target, true);
      const outcome = await this.decide(tx, input.email, target);
      if (outcome.type === 'grant') {
        await this.grant(tx, principal.userId, outcome.user.id, target);
        await this.outbox.add(tx, {
          type: 'user.access_granted',
          payload: { userId: outcome.user.id, ...targetIds(target) },
        });
        return { created: { outcome: 'access_granted', user: outcome.user }, isNew: false };
      }
      const userId =
        outcome.type === 'further_invitation'
          ? outcome.userId
          : (
              await tx.user.create({
                data: { email: input.email, kind: target.kind, state: 'invited' },
                select: { id: true },
              })
            ).id;
      const now = this.clock.now();
      const { token, tokenHash, expiresAt } = newToken(now);
      const ids = targetIds(target);
      const { id } = await tx.invitation.create({
        data: {
          userId,
          target: target.type,
          projectId: ids.projectId,
          role: ids.role,
          organizationId:
            outcome.type === 'new_account' && outcome.organization !== null
              ? outcome.organization.id
              : ids.organizationId,
          invitedById: principal.userId,
          tokenHash,
          expiresAt,
        },
        select: { id: true },
      });
      await this.auditLog.record(tx, {
        action: 'invitation.issued',
        actorId: principal.userId,
        target: { type: INVITATION, id },
        details: { userId, target: target.type },
      });
      await this.outbox.add(tx, {
        type: 'invitation.issued',
        payload: { invitationId: id, userId },
      });
      return {
        created: {
          outcome: 'invited',
          invitation: toInvitationResponse(
            await this.findVisible(tx, ability, principal, id),
            ability,
            now,
          ),
          link: invitationLink(this.config.domain, token),
        },
        isNew: true,
      };
    });
  }

  /**
   * The target of a new invitation, checked as the invitation it would create (§7.4): a project or
   * an organization the principal cannot see is `404`; a visible one they may not invite to – and
   * the Administrator role, which is no record – `403`; an archived one `409`; a team invitation
   * without GitHub sign-in `422`. With `lock`, the project or organization stays share-locked for
   * the transaction, so an archive cannot pass unseen (§7.3).
   */
  private async resolveTarget(
    tx: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    target: InvitationTarget,
    lock = false,
  ): Promise<ResolvedTarget> {
    const resolved = await this.findTarget(tx, ability, principal, target, lock);
    if (resolved.kind === 'team') {
      this.assertGithubSignInConfigured();
    }
    return resolved;
  }

  private async findTarget(
    tx: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    target: InvitationTarget,
    lock: boolean,
  ): Promise<ResolvedTarget> {
    switch (target.type) {
      case 'project': {
        if (lock && !(await this.projects.lockForShare(tx, target.projectId))) {
          throw new AppError('request.not_found');
        }
        const project = await tx.project.findFirst({
          where: {
            AND: [accessibleBy(ability, 'read').ofType('Project'), { id: target.projectId }],
          },
          select: {
            id: true,
            key: true,
            name: true,
            state: true,
            members: { where: { userId: principal.userId }, select: { userId: true, role: true } },
          },
        });
        if (project === null) {
          throw new AppError('request.not_found');
        }
        this.assertCan(ability, CREATE, { target: 'project', project });
        if (project.state === 'archived') {
          throw new AppError('project.archived');
        }
        return {
          type: 'project',
          project: { id: project.id, key: project.key, name: project.name },
          role: target.role,
          kind: target.role === 'end_user' ? 'end_user' : 'team',
        };
      }
      case 'organization': {
        if (lock && !(await this.organizations.lockForShare(tx, target.organizationId))) {
          throw new AppError('request.not_found');
        }
        const organization = await tx.organization.findFirst({
          where: {
            AND: [
              accessibleBy(ability, 'read').ofType('Organization'),
              { id: target.organizationId },
            ],
          },
          select: { id: true, name: true, state: true },
        });
        if (organization === null) {
          throw new AppError('request.not_found');
        }
        this.assertCan(ability, CREATE, { target: 'organization', project: null });
        if (organization.state === 'archived') {
          throw new AppError('organization.archived');
        }
        return {
          type: 'organization',
          organization: { id: organization.id, name: organization.name },
          kind: 'end_user',
        };
      }
      case 'administrator':
        this.assertCan(ability, CREATE, { target: 'administrator', project: null });
        return { type: 'administrator', kind: 'team' };
    }
  }

  /**
   * What issuing does for the address (§7.4): a new account with a new invitation – with the
   * organization of its e-mail domain for an end user invited to a project (§7.3) – a further
   * invitation of an `invited` account, or a direct grant to an active one; refused for a
   * deactivated account, an account of the other kind and access that exists.
   */
  private async decide(tx: Transaction, email: string, target: ResolvedTarget): Promise<Outcome> {
    const account = await tx.user.findUnique({
      where: { email },
      select: {
        id: true,
        kind: true,
        state: true,
        isAdmin: true,
        displayName: true,
        organizationMember: { select: { organizationId: true } },
      },
    });
    if (account === null) {
      return {
        type: 'new_account',
        organization:
          target.type === 'project' && target.role === 'end_user'
            ? await this.organizations.findForInvitation(tx, email, target.project.id)
            : null,
      };
    }
    if (account.state === 'deactivated' || account.state === 'anonymized') {
      throw new AppError('invitation.account_deactivated', [
        { pointer: '/email', code: 'field.invalid' },
      ]);
    }
    if (account.kind !== target.kind) {
      throw new AppError('invitation.account_kind_mismatch', [
        { pointer: '/email', code: 'field.invalid' },
      ]);
    }
    await this.assertNoAccess(tx, account, target);
    return account.state === 'active'
      ? { type: 'grant', user: { id: account.id, displayName: account.displayName } }
      : { type: 'further_invitation', userId: account.id };
  }

  /**
   * Refuses access an account has already (§7.4): a membership of the project – for an end user
   * also through their organization – the organization itself, or the Administrator role. An end
   * user of another organization is not invited to an organization: moving is an Administrator
   * action (§7.3).
   */
  private async assertNoAccess(
    tx: Transaction,
    account: {
      id: string;
      isAdmin: boolean;
      organizationMember: { organizationId: string } | null;
    },
    target: ResolvedTarget,
  ): Promise<void> {
    const organizationId = account.organizationMember?.organizationId ?? null;
    switch (target.type) {
      case 'project': {
        const isMember =
          (await tx.projectMember.count({
            where: { projectId: target.project.id, userId: account.id },
          })) > 0;
        const hasOrganizationAccess =
          organizationId !== null &&
          (await tx.organizationProject.count({
            where: { organizationId, projectId: target.project.id },
          })) > 0;
        if (isMember || hasOrganizationAccess) {
          throw new AppError('invitation.access_exists');
        }
        return;
      }
      case 'organization':
        if (organizationId === target.organization.id) {
          throw new AppError('invitation.access_exists');
        }
        if (organizationId !== null) {
          throw new AppError('invitation.organization_conflict', [
            { pointer: '/email', code: 'field.invalid' },
          ]);
        }
        return;
      case 'administrator':
        if (account.isAdmin) {
          throw new AppError('invitation.access_exists');
        }
        return;
    }
  }

  /**
   * Joins the organization matched at issue when it is still active and still has the project
   * (§7.3); `false` when the account gets personal access instead.
   */
  private async joinMatchedOrganization(
    tx: Transaction,
    actorId: string | null,
    userId: string,
    organizationId: string,
    projectId: string,
  ): Promise<boolean> {
    if (!(await this.organizations.lockForShare(tx, organizationId))) {
      return false;
    }
    const organization = await tx.organization.findFirst({
      where: { id: organizationId, state: 'active', projects: { some: { projectId } } },
      select: { id: true },
    });
    if (organization === null) {
      return false;
    }
    if (await this.organizations.addMembership(tx, actorId, organizationId, userId)) {
      return true;
    }
    const membership = await tx.organizationMember.findUnique({
      where: { userId },
      select: { organizationId: true },
    });
    return membership?.organizationId === organizationId;
  }

  /**
   * An invitation the principal can see, through the `read` filter of the ability: `404`
   * otherwise (§17.2). With an action: `403`, `409 project.archived` or `409
   * organization.archived` for an archived target, `409 invitation.not_pending` in a state the
   * action does not apply to.
   */
  private async findVisible(
    tx: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    invitationId: string,
    action?: InvitationAction,
  ): Promise<InvitationRow> {
    const row = await tx.invitation.findFirst({
      where: { AND: [accessibleBy(ability, 'read').ofType(INVITATION), { id: invitationId }] },
      select: invitationSelect(principal),
    });
    if (row === null) {
      throw new AppError('request.not_found');
    }
    if (action !== undefined) {
      this.assertCan(ability, action, row);
      if (row.project?.state === 'archived') {
        throw new AppError('project.archived');
      }
      if (row.target === 'organization' && row.organization?.state === 'archived') {
        throw new AppError('organization.archived');
      }
      if (!STATES_OF_ACTIONS[action].includes(invitationState(row, this.clock.now()))) {
        throw new AppError('invitation.not_pending');
      }
    }
    return row;
  }

  /** `403`, or the code of the denying rule. */
  private assertCan(ability: AppAbility, action: string, row: RuleRow): void {
    const record = ruleRecord(row);
    if (!ability.can(action, record)) {
      throw new AppError(reasonCode(ability.relevantRuleFor(action, record)?.reason));
    }
  }

  /** Team members sign in with GitHub, so their invitations need it configured (§15.6). */
  private assertGithubSignInConfigured(): void {
    if (!this.config.isGithubSignInConfigured) {
      throw new AppError('invitation.github_sign_in_missing');
    }
  }
}

/** The identifiers of a target, as the invitation row and the events store them. */
function targetIds(target: ResolvedTarget): {
  target: ResolvedTarget['type'];
  projectId: string | null;
  role: ProjectMemberRole | null;
  organizationId: string | null;
} {
  return {
    target: target.type,
    projectId: target.type === 'project' ? target.project.id : null,
    role: target.type === 'project' ? target.role : null,
    organizationId: target.type === 'organization' ? target.organization.id : null,
  };
}
