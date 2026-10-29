import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { Injectable } from '@nestjs/common';
import {
  type ProductTourId,
  type ProductTourProgress,
  type ProductTourProgressPage,
  productTourIdSchema,
  type RecordProductTourProgressDto,
} from '@trybun/contracts/product-tours';
import {
  type CurrentUser,
  type CurrentUserAction,
  languageSchema,
  type ListUsersQuery,
  type UpdateCurrentUserDto,
  type User,
  type UserAction,
  userActionSchema,
  type UserPage,
} from '@trybun/contracts/users';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { SessionsService } from '../../platform/authentication/sessions.service.js';
import { AbilityFactory, type AppAbility } from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import { Clock } from '../../platform/clock/clock.js';
import { decodeCursor, toPage } from '../../platform/database/cursor.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { AppError } from '../../platform/errors/app-error.js';
import { OutboxService } from '../../platform/outbox/outbox.service.js';
import { ADMINISTRATION } from '../administration/administration.abilities.js';
import {
  AuditLogEntriesService,
  type AuditLogEntryInput,
} from '../audit-log-entries/audit-log-entries.service.js';
import {
  CREATE as CREATE_ORGANIZATION,
  ORGANIZATION,
} from '../organizations/organizations.abilities.js';
import { InvitationRevocationsService } from '../invitations/invitation-revocations.service.js';
import { CREATE, PROJECT } from '../projects/projects.abilities.js';
import { USER } from './users.abilities.js';
import { USER_DEACTIVATED, USER_REACTIVATED, type UserEventPayload } from './users.events.js';
import { lockAccount, lockActiveAdministrators } from './users.sql.js';

const PRODUCT_TOUR_PROGRESS_SELECT = {
  tourId: true,
  tourVersion: true,
  status: true,
  updatedAt: true,
} satisfies Prisma.ProductTourProgressSelect;

type ProductTourProgressRow = Prisma.ProductTourProgressGetPayload<{
  select: typeof PRODUCT_TOUR_PROGRESS_SELECT;
}>;

/** The response shape of a progress record (§18.3). */
function toProductTourProgressResponse(row: ProductTourProgressRow): ProductTourProgress {
  return {
    tourId: productTourIdSchema.parse(row.tourId),
    tourVersion: row.tourVersion,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const USER_SELECT = {
  id: true,
  displayName: true,
  email: true,
  kind: true,
  state: true,
  isAdmin: true,
  githubLogin: true,
  keycloakUserId: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

function toUserSubject(row: UserRow) {
  return subject(USER, { id: row.id, kind: row.kind, state: row.state, isAdmin: row.isAdmin });
}

/** The response shape of an account on the Accounts page (§18.3) with the principal's actions. */
function toUserResponse(row: UserRow, ability: AppAbility): User {
  const record = toUserSubject(row);
  return {
    id: row.id,
    displayName: row.displayName,
    email: row.email,
    kind: row.kind,
    state: row.state,
    isAdmin: row.isAdmin,
    githubLogin: row.githubLogin,
    createdAt: row.createdAt.toISOString(),
    allowedActions: userActionSchema.options.filter((action) => ability.can(action, record)),
  };
}

/** Accounts are sorted by display name – accounts without one last – then ID. */
const userSortKeySchema = z.tuple([z.string().nullable(), z.uuid()]);

/** The accounts after a cursor of the order by display name (nulls last), then ID. */
function usersAfter(after: z.infer<typeof userSortKeySchema> | null): Prisma.UserWhereInput {
  if (after === null) {
    return {};
  }
  const [displayName, id] = after;
  if (displayName === null) {
    return { displayName: null, id: { gt: id } };
  }
  return {
    OR: [
      { displayName: { gt: displayName } },
      { displayName, id: { gt: id } },
      { displayName: null },
    ],
  };
}

/** The action of an audit entry on an account. */
type UserAuditAction = Extract<AuditLogEntryInput['action'], `user.${string}`>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
    private readonly clock: Clock,
    private readonly auditLog: AuditLogEntriesService,
    private readonly outbox: OutboxService,
    private readonly sessions: SessionsService,
    private readonly invitationRevocations: InvitationRevocationsService,
  ) {}

  /**
   * The account of the principal itself (§7.4) with its global actions (§18.3). The
   * authentication guard has already resolved it as an active account, so it exists.
   */
  async findCurrent(principal: UserPrincipal): Promise<CurrentUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        kind: true,
        language: true,
        timeZone: true,
      },
    });
    const ability = this.abilities.forPrincipal(principal);
    const allowedActions: CurrentUserAction[] = [];
    if (ability.can('read', ADMINISTRATION)) {
      allowedActions.push('open_administration');
    }
    if (ability.can(CREATE, PROJECT)) {
      allowedActions.push('create_project');
    }
    if (ability.can(CREATE_ORGANIZATION, ORGANIZATION)) {
      allowedActions.push('create_organization');
    }
    // The column holds a language of the catalogues; any other value means the system default.
    const language = languageSchema.safeParse(user.language).data ?? null;
    return { ...user, language, allowedActions };
  }

  /**
   * The product tour progress of the principal itself (§2.4). The list is bounded by the closed
   * list of tours, so it is one page (§18.4).
   */
  async findProductTourProgress(principal: UserPrincipal): Promise<ProductTourProgressPage> {
    const rows = await this.prisma.productTourProgress.findMany({
      // The progress of a tour that no longer exists is kept but not returned.
      where: { userId: principal.userId, tourId: { in: productTourIdSchema.options } },
      select: PRODUCT_TOUR_PROGRESS_SELECT,
      orderBy: { tourId: 'asc' },
    });
    return { items: rows.map(toProductTourProgressResponse), nextCursor: null };
  }

  /**
   * Records how the principal ended a tour (§2.4). The record belongs only to the principal and
   * has no version: the last write wins, as when two devices end the same tour.
   */
  async recordProductTourProgress(
    principal: UserPrincipal,
    tourId: ProductTourId,
    input: RecordProductTourProgressDto,
  ): Promise<ProductTourProgress> {
    const row = await this.prisma.productTourProgress.upsert({
      where: { userId_tourId: { userId: principal.userId, tourId } },
      create: { userId: principal.userId, tourId, ...input },
      update: input,
      select: PRODUCT_TOUR_PROGRESS_SELECT,
    });
    return toProductTourProgressResponse(row);
  }
  /**
   * Changes the settings of the principal's own account (§13.1): the language and the time zone;
   * `timeZone: null` returns to the system default.
   */
  async updateCurrent(principal: UserPrincipal, input: UpdateCurrentUserDto): Promise<CurrentUser> {
    await this.prisma.user.update({
      where: { id: principal.userId },
      data: { language: input.language, timeZone: input.timeZone },
      select: { id: true },
    });
    return this.findCurrent(principal);
  }

  /**
   * The accounts of the Accounts page (§7.4), sorted by display name: filtered by kind and state,
   * searched by display name and e-mail address. The Administrator only; for everyone else the
   * list is `404` like its records (§7.5).
   */
  async list(principal: UserPrincipal, query: ListUsersQuery): Promise<UserPage> {
    const ability = this.abilities.forPrincipal(principal);
    if (!ability.can('read', USER)) {
      throw new AppError('request.not_found');
    }
    const after = decodeCursor(query.cursor, userSortKeySchema);
    const search = query.query === undefined || query.query === '' ? undefined : query.query;
    const rows = await this.prisma.user.findMany({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType(USER),
          { kind: query.kind, state: query.state },
          search === undefined
            ? {}
            : {
                OR: [
                  { displayName: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              },
          usersAfter(after),
        ],
      },
      select: USER_SELECT,
      orderBy: [{ displayName: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      take: query.limit + 1,
    });
    return toPage(
      rows,
      query.limit,
      (row) => toUserResponse(row, ability),
      (row) => [row.displayName, row.id],
    );
  }

  /**
   * Deactivates an account (§7.4) in one transaction: its state, its pending invitations revoked,
   * its web sessions deleted, the audit entry and the outbox event, whose job disables the
   * Keycloak user and ends its Keycloak sessions. The API refuses the account's next request at
   * once, because only active accounts have a principal (§14.4).
   */
  async deactivate(principal: UserPrincipal, userId: string): Promise<void> {
    const ability = this.abilities.forPrincipal(principal);
    await this.prisma.$transaction(async (tx) => {
      const row = await this.lockForChange(tx, ability, userId, { mayRemoveAdministrator: true });
      this.assertCan(ability, 'deactivate', row);
      await tx.user.update({
        where: { id: userId },
        data: { state: 'deactivated' },
        select: { id: true },
      });
      await this.invitationRevocations.revokeForUser(tx, userId);
      if (row.keycloakUserId !== null) {
        await this.sessions.deleteAllOf(tx, row.keycloakUserId);
      }
      await this.record(tx, principal, userId, 'user.deactivated');
      await this.outbox.add(tx, {
        type: USER_DEACTIVATED,
        payload: { userId } satisfies UserEventPayload,
      });
    });
  }

  /**
   * Reactivates an account (§7.4): `active` again, or `invited` while it has no Keycloak user;
   * the job enables the Keycloak user. Revoked invitations stay revoked, earlier access is kept.
   */
  async reactivate(principal: UserPrincipal, userId: string): Promise<void> {
    const ability = this.abilities.forPrincipal(principal);
    await this.prisma.$transaction(async (tx) => {
      const row = await this.lockForChange(tx, ability, userId, { mayRemoveAdministrator: false });
      this.assertCan(ability, 'reactivate', row);
      await tx.user.update({
        where: { id: userId },
        data: { state: row.keycloakUserId === null ? 'invited' : 'active' },
        select: { id: true },
      });
      await this.record(tx, principal, userId, 'user.reactivated');
      await this.outbox.add(tx, {
        type: USER_REACTIVATED,
        payload: { userId } satisfies UserEventPayload,
      });
    });
  }

  /**
   * Grants the Administrator role to an active team account (§7.5). Idempotent: an
   * Administrator stays unchanged, without an audit entry.
   */
  async grantAdministratorRole(principal: UserPrincipal, userId: string): Promise<void> {
    const ability = this.abilities.forPrincipal(principal);
    await this.prisma.$transaction(async (tx) => {
      const row = await this.lockForChange(tx, ability, userId, { mayRemoveAdministrator: false });
      if (row.isAdmin) {
        return;
      }
      this.assertCan(ability, 'grant_admin', row);
      await tx.user.update({
        where: { id: userId },
        data: { isAdmin: true },
        select: { id: true },
      });
      await this.record(tx, principal, userId, 'user.admin_granted');
    });
  }

  /**
   * Revokes the Administrator role (§7.5). Idempotent: an account without it stays unchanged,
   * without an audit entry. Nobody revokes their own role, and the last active Administrator
   * keeps it (§7.4).
   */
  async revokeAdministratorRole(principal: UserPrincipal, userId: string): Promise<void> {
    const ability = this.abilities.forPrincipal(principal);
    await this.prisma.$transaction(async (tx) => {
      const row = await this.lockForChange(tx, ability, userId, { mayRemoveAdministrator: true });
      if (!row.isAdmin) {
        return;
      }
      this.assertCan(ability, 'revoke_admin', row);
      await tx.user.update({
        where: { id: userId },
        data: { isAdmin: false },
        select: { id: true },
      });
      await this.record(tx, principal, userId, 'user.admin_revoked');
    });
  }

  /**
   * Locks an account for a change of its state or role and reads it through the `read` filter of
   * the ability (`404` otherwise, §17.2). Accounts are not versioned: the lock makes concurrent
   * changes wait and re-read. A change that may remove an active Administrator first locks all of
   * them and refuses to remove the last one (`409 user.last_administrator`, §7.4) – before the
   * rules of the ability, so the last Administrator learns why even about their own account.
   */
  private async lockForChange(
    tx: Transaction,
    ability: AppAbility,
    userId: string,
    { mayRemoveAdministrator }: { mayRemoveAdministrator: boolean },
  ): Promise<UserRow> {
    const administrators = mayRemoveAdministrator ? await lockActiveAdministrators(tx) : [];
    if (!(await lockAccount(tx, userId))) {
      throw new AppError('request.not_found');
    }
    const row = await tx.user.findFirst({
      where: { AND: [accessibleBy(ability, 'read').ofType(USER), { id: userId }] },
      select: USER_SELECT,
    });
    if (row === null) {
      throw new AppError('request.not_found');
    }
    const isLastAdministrator =
      row.isAdmin && row.state === 'active' && administrators.every((id) => id === userId);
    if (mayRemoveAdministrator && isLastAdministrator) {
      throw new AppError('user.last_administrator');
    }
    return row;
  }

  /** `403`, or the code of the denying rule. */
  private assertCan(ability: AppAbility, action: UserAction, row: UserRow): void {
    const record = toUserSubject(row);
    if (!ability.can(action, record)) {
      throw new AppError(reasonCode(ability.relevantRuleFor(action, record)?.reason));
    }
  }

  /** An audit entry of the principal on an account (§13.5). */
  private record(
    tx: Transaction,
    principal: UserPrincipal,
    userId: string,
    action: UserAuditAction,
  ): Promise<void> {
    return this.auditLog.record(tx, {
      action,
      actorId: principal.userId,
      target: { type: USER, id: userId },
    });
  }
}
