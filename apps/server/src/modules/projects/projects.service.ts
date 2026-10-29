import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { Injectable } from '@nestjs/common';
import {
  type AddProjectMemberDto,
  type ChangeProjectMemberRoleDto,
  type CreateProjectDto,
  type ListMemberCandidatesQuery,
  type ListProjectMembersQuery,
  type ListProjectsQuery,
  type MemberCandidatePage,
  type Project,
  type ProjectAccount,
  type ProjectAction,
  projectActionSchema,
  type ProjectMemberRole,
  type ProjectMember,
  type ProjectMemberPage,
  type ProjectPage,
  type UpdateProjectDto,
} from '@trybun/contracts/projects';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory, type AppAbility } from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import { decodeCursor, toPage } from '../../platform/database/cursor.js';
import {
  assertVersionMatched,
  type VersionedTarget,
  versionedUpdate,
  versionedWhere,
} from '../../platform/database/optimistic-locking.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { isUniqueViolation } from '../../platform/database/unique-violation.js';
import { AppError } from '../../platform/errors/app-error.js';
import { AuditLogEntriesService } from '../audit-log-entries/audit-log-entries.service.js';
import { InvitationRevocationsService } from '../invitations/invitation-revocations.service.js';
import { CREATE, PROJECT } from './projects.abilities.js';
import { lockProjectForShare } from './projects.sql.js';

/** The fields of a project response and of its rules: the principal's own membership. */
function projectSelect(principal: UserPrincipal) {
  return {
    id: true,
    name: true,
    key: true,
    state: true,
    confirmResolution: true,
    version: true,
    createdAt: true,
    updatedAt: true,
    members: { where: { userId: principal.userId }, select: { userId: true, role: true } },
  } satisfies Prisma.ProjectSelect;
}

type ProjectRow = Prisma.ProjectGetPayload<{ select: ReturnType<typeof projectSelect> }>;

/** The response shape of a project (§18.3) with the actions the principal may perform on it. */
function toProjectResponse(row: ProjectRow, ability: AppAbility): Project {
  const record = subject(PROJECT, row);
  return {
    id: row.id,
    name: row.name,
    key: row.key,
    state: row.state,
    confirmResolution: row.confirmResolution,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    role: row.members[0]?.role ?? null,
    allowedActions: projectActionSchema.options.filter((action) => ability.can(action, record)),
  };
}

const ACCOUNT_SELECT = {
  id: true,
  displayName: true,
  githubLogin: true,
} satisfies Prisma.UserSelect;

const MEMBER_SELECT = {
  userId: true,
  role: true,
  createdAt: true,
  user: { select: ACCOUNT_SELECT },
} satisfies Prisma.ProjectMemberSelect;

type MemberRow = Prisma.ProjectMemberGetPayload<{ select: typeof MEMBER_SELECT }>;

/** The response shape of a member (§18.3): no e-mail address. */
function toMemberResponse(row: MemberRow): ProjectMember {
  return { user: row.user, role: row.role, createdAt: row.createdAt.toISOString() };
}

/** Projects are sorted by name, then ID. */
const projectSortKeySchema = z.tuple([z.string(), z.uuid()]);

/** Accounts are sorted by display name – accounts without one last – then ID. */
const accountSortKeySchema = z.tuple([z.string().nullable(), z.uuid()]);

/** The accounts after a cursor of the order by display name (nulls last), then ID. */
function accountsAfter(after: z.infer<typeof accountSortKeySchema> | null): Prisma.UserWhereInput {
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

const ACCOUNT_ORDER = [
  { displayName: { sort: 'asc', nulls: 'last' } },
  { id: 'asc' },
] satisfies Prisma.UserOrderByWithRelationInput[];

function keyTaken(): AppError {
  return new AppError('project.key_taken', [{ pointer: '/key', code: 'field.invalid' }]);
}

/**
 * Projects (§3.1, §7.3) and their members (§7.4). Each use case is one transaction (§18.3); the
 * target record guard has already checked the action on the project, and every change re-checks
 * it on the project read inside its transaction.
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
    private readonly auditLog: AuditLogEntriesService,
    private readonly invitationRevocations: InvitationRevocationsService,
  ) {}

  /** The projects in one state the principal can see, sorted by name. */
  async list(principal: UserPrincipal, query: ListProjectsQuery): Promise<ProjectPage> {
    const ability = this.abilities.forPrincipal(principal);
    const after = decodeCursor(query.cursor, projectSortKeySchema);
    const rows = await this.prisma.project.findMany({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType(PROJECT),
          { state: query.state },
          after === null
            ? {}
            : { OR: [{ name: { gt: after[0] } }, { name: after[0], id: { gt: after[1] } }] },
        ],
      },
      select: projectSelect(principal),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
    });
    return toPage(
      rows,
      query.limit,
      (row) => toProjectResponse(row, ability),
      (row) => [row.name, row.id],
    );
  }

  async findOne(principal: UserPrincipal, projectId: string): Promise<Project> {
    const ability = this.abilities.forPrincipal(principal);
    const row = await this.findVisible(this.prisma, ability, principal, projectId);
    return toProjectResponse(row, ability);
  }

  /** Creates a project (§3.1); the key is unique across active and archived projects. */
  async create(principal: UserPrincipal, input: CreateProjectDto): Promise<Project> {
    const ability = this.abilities.forPrincipal(principal);
    if (!ability.can(CREATE, PROJECT)) {
      throw new AppError('request.forbidden');
    }
    return this.withUniqueKey(() =>
      this.prisma.$transaction(async (tx) => {
        await this.assertKeyFree(tx, input.key);
        const row = await tx.project.create({ data: input, select: projectSelect(principal) });
        await this.auditLog.record(tx, {
          action: 'project.created',
          actorId: principal.userId,
          target: { type: PROJECT, id: row.id },
        });
        return toProjectResponse(row, ability);
      }),
    );
  }

  /**
   * Changes the name and the key (`update`) or the settings (`update_settings`). A body with a
   * field the principal may not change is rejected as a whole with `403` (§18.3). The key stays
   * editable while the project has no tickets (§3.1), which is always the case before S1-05.
   */
  async update(
    principal: UserPrincipal,
    target: VersionedTarget,
    input: UpdateProjectDto,
  ): Promise<Project> {
    const ability = this.abilities.forPrincipal(principal);
    return this.withUniqueKey(() =>
      this.prisma.$transaction(async (tx) => {
        const row = await this.findVisible(tx, ability, principal, target.id);
        if (input.name !== undefined || input.key !== undefined) {
          this.assertCan(ability, 'update', row);
        }
        if (input.confirmResolution !== undefined) {
          this.assertCan(ability, 'update_settings', row);
        }
        if (input.key !== undefined && input.key !== row.key) {
          await this.assertKeyFree(tx, input.key);
        }
        assertVersionMatched(await tx.project.updateMany(versionedUpdate(target, input)));
        return toProjectResponse(
          await this.findVisible(tx, ability, principal, target.id),
          ability,
        );
      }),
    );
  }

  /**
   * Archives a project: read-only for everyone until it is unarchived (§7.3); its pending
   * invitations are revoked.
   */
  async archive(principal: UserPrincipal, target: VersionedTarget): Promise<Project> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      this.assertCan(ability, 'archive', await this.findVisible(tx, ability, principal, target.id));
      assertVersionMatched(
        await tx.project.updateMany(versionedUpdate(target, { state: 'archived' })),
      );
      await this.auditLog.record(tx, {
        action: 'project.archived',
        actorId: principal.userId,
        target: { type: PROJECT, id: target.id },
      });
      await this.invitationRevocations.revokeForProject(tx, target.id);
      return toProjectResponse(await this.findVisible(tx, ability, principal, target.id), ability);
    });
  }

  /**
   * Unarchives a project (§7.3). An active project stays unchanged, without an audit entry; its
   * `If-Match` is still checked.
   */
  async unarchive(principal: UserPrincipal, target: VersionedTarget): Promise<void> {
    const ability = this.abilities.forPrincipal(principal);
    await this.prisma.$transaction(async (tx) => {
      const row = await this.findVisible(tx, ability, principal, target.id);
      this.assertCan(ability, 'unarchive', row);
      if (row.state === 'active') {
        assertVersionMatched({ count: row.version === target.version ? 1 : 0 });
        return;
      }
      assertVersionMatched(
        await tx.project.updateMany(versionedUpdate(target, { state: 'active' })),
      );
      await this.auditLog.record(tx, {
        action: 'project.unarchived',
        actorId: principal.userId,
        target: { type: PROJECT, id: target.id },
      });
    });
  }

  /**
   * Deletes a project with its memberships (§7.3); one audit entry stands for both. The key becomes
   * free again (§3.1).
   */
  async delete(principal: UserPrincipal, target: VersionedTarget): Promise<void> {
    const ability = this.abilities.forPrincipal(principal);
    await this.prisma.$transaction(async (tx) => {
      this.assertCan(ability, 'delete', await this.findVisible(tx, ability, principal, target.id));
      assertVersionMatched(await tx.project.deleteMany({ where: versionedWhere(target) }));
      await this.auditLog.record(tx, {
        action: 'project.deleted',
        actorId: principal.userId,
        target: { type: PROJECT, id: target.id },
      });
    });
  }

  /** The members of a project, sorted by display name; `role` filters them. */
  async listMembers(
    principal: UserPrincipal,
    projectId: string,
    query: ListProjectMembersQuery,
  ): Promise<ProjectMemberPage> {
    const ability = this.abilities.forPrincipal(principal);
    const after = decodeCursor(query.cursor, accountSortKeySchema);
    const rows = await this.prisma.projectMember.findMany({
      where: {
        AND: [
          { project: accessibleBy(ability, 'read_members').ofType(PROJECT) },
          { projectId, role: query.role, user: accountsAfter(after) },
        ],
      },
      select: MEMBER_SELECT,
      orderBy: ACCOUNT_ORDER.map((order) => ({ user: order })),
      take: query.limit + 1,
    });
    return toPage(rows, query.limit, toMemberResponse, (row) => [
      row.user.displayName,
      row.user.id,
    ]);
  }

  /**
   * The member picker (§7.4): the active team accounts that are not members of the project,
   * searched by display name and GitHub login. Only who may manage the members sees them.
   */
  async listMemberCandidates(
    principal: UserPrincipal,
    projectId: string,
    query: ListMemberCandidatesQuery,
  ): Promise<MemberCandidatePage> {
    const ability = this.abilities.forPrincipal(principal);
    await this.findVisible(this.prisma, ability, principal, projectId, 'manage_members');
    const after = decodeCursor(query.cursor, accountSortKeySchema);
    const search = query.query === undefined || query.query === '' ? undefined : query.query;
    const rows = await this.prisma.user.findMany({
      where: {
        AND: [
          { kind: 'team', state: 'active', projectMemberships: { none: { projectId } } },
          search === undefined
            ? {}
            : {
                OR: [
                  { displayName: { contains: search, mode: 'insensitive' } },
                  { githubLogin: { contains: search, mode: 'insensitive' } },
                ],
              },
          accountsAfter(after),
        ],
      },
      select: ACCOUNT_SELECT,
      orderBy: ACCOUNT_ORDER,
      take: query.limit + 1,
    });
    return toPage(
      rows,
      query.limit,
      (row): ProjectAccount => row,
      (row) => [row.displayName, row.id],
    );
  }

  /**
   * Adds an active team account to a project with a team role (§7.4). Invitations (S1-03) add
   * existing accounts through this use case too.
   */
  async addMember(
    principal: UserPrincipal,
    projectId: string,
    input: AddProjectMemberDto,
  ): Promise<ProjectMember> {
    const ability = this.abilities.forPrincipal(principal);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockForMembership(tx, ability, principal, projectId);
        const user = await tx.user.findFirst({
          where: { id: input.userId, kind: 'team', state: 'active' },
          select: { id: true },
        });
        if (user === null) {
          throw new AppError('project_member.user_not_eligible', [
            { pointer: '/userId', code: 'field.invalid' },
          ]);
        }
        if ((await tx.projectMember.count({ where: { projectId, userId: input.userId } })) > 0) {
          throw new AppError('project_member.exists');
        }
        const row = await tx.projectMember.create({
          data: { projectId, ...input },
          select: MEMBER_SELECT,
        });
        await this.auditLog.record(tx, {
          action: 'project_member.added',
          actorId: principal.userId,
          target: { type: PROJECT, id: projectId },
          details: { userId: input.userId, role: input.role },
        });
        return toMemberResponse(row);
      });
    } catch (error) {
      // Two concurrent additions of one account: the second meets the primary key.
      if (isUniqueViolation(error)) {
        throw new AppError('project_member.exists');
      }
      throw error;
    }
  }

  /**
   * Changes the team role of a member. Demoting the last Project manager is allowed; the web
   * application warns about it (§7.4).
   */
  async changeMemberRole(
    principal: UserPrincipal,
    projectId: string,
    userId: string,
    input: ChangeProjectMemberRoleDto,
  ): Promise<ProjectMember> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      await this.lockForMembership(tx, ability, principal, projectId);
      const member = await this.findMember(tx, projectId, userId);
      if (member.role === input.role) {
        return toMemberResponse(member);
      }
      const row = await tx.projectMember.update({
        where: { projectId_userId: { projectId, userId } },
        data: { role: input.role },
        select: MEMBER_SELECT,
      });
      await this.auditLog.record(tx, {
        action: 'project_member.role_changed',
        actorId: principal.userId,
        target: { type: PROJECT, id: projectId },
        details: { userId, role: input.role, previousRole: member.role },
      });
      return toMemberResponse(row);
    });
  }

  /**
   * Removes a member from a project. Removing the last Project manager is allowed; the web
   * application warns about it (§7.4). Unassigning their open tickets arrives with S1-05.
   */
  async removeMember(principal: UserPrincipal, projectId: string, userId: string): Promise<void> {
    const ability = this.abilities.forPrincipal(principal);
    await this.prisma.$transaction(async (tx) => {
      await this.lockForMembership(tx, ability, principal, projectId);
      const member = await this.findMember(tx, projectId, userId);
      await tx.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
      await this.auditLog.record(tx, {
        action: 'project_member.removed',
        actorId: principal.userId,
        target: { type: PROJECT, id: projectId },
        details: { userId, role: member.role },
      });
    });
  }

  /**
   * Locks a project in share mode for the rest of a transaction of another module whose change
   * depends on the project's state (invitations, S1-03): a concurrent archive waits for it, or it
   * waits for the archive and reads the archived state (§7.3). Returns whether it exists.
   */
  lockForShare(tx: Transaction, projectId: string): Promise<boolean> {
    return lockProjectForShare(tx, projectId);
  }

  /**
   * Gives an account a role in a project as an effect of an invitation (§7.4): a direct grant to
   * an active account or the acceptance of an invitation, already authorized by the caller, which
   * holds the share lock of the project. Returns `false` – without a change or an audit entry –
   * when the account is a member already.
   */
  async addMembership(
    tx: Transaction,
    actorId: string | null,
    projectId: string,
    userId: string,
    role: ProjectMemberRole,
  ): Promise<boolean> {
    if ((await tx.projectMember.count({ where: { projectId, userId } })) > 0) {
      return false;
    }
    await tx.projectMember.create({ data: { projectId, userId, role }, select: { userId: true } });
    await this.auditLog.record(tx, {
      action: 'project_member.added',
      actorId,
      target: { type: PROJECT, id: projectId },
      details: { userId, role },
    });
    return true;
  }

  /**
   * A project the principal can see, through the `read` filter of the ability: `404` otherwise
   * (§17.2). With an action, a project on which it is not permitted returns the code of the
   * denying rule (e.g. `409 project.archived`) or `403`.
   */
  private async findVisible(
    db: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    projectId: string,
    action?: ProjectAction,
  ): Promise<ProjectRow> {
    const row = await db.project.findFirst({
      where: { AND: [accessibleBy(ability, 'read').ofType(PROJECT), { id: projectId }] },
      select: projectSelect(principal),
    });
    if (row === null) {
      throw new AppError('request.not_found');
    }
    if (action !== undefined) {
      this.assertCan(ability, action, row);
    }
    return row;
  }

  private assertCan(ability: AppAbility, action: ProjectAction, row: ProjectRow): void {
    const record = subject(PROJECT, row);
    if (!ability.can(action, record)) {
      throw new AppError(reasonCode(ability.relevantRuleFor(action, record)?.reason));
    }
  }

  /**
   * Memberships are not versioned: a membership change locks the project row and re-reads it, so
   * no member changes in a project archived concurrently (§7.3).
   */
  private async lockForMembership(
    tx: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    projectId: string,
  ): Promise<void> {
    if (!(await lockProjectForShare(tx, projectId))) {
      throw new AppError('request.not_found');
    }
    await this.findVisible(tx, ability, principal, projectId, 'manage_members');
  }

  private async findMember(tx: Transaction, projectId: string, userId: string): Promise<MemberRow> {
    const member = await tx.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: MEMBER_SELECT,
    });
    if (member === null) {
      throw new AppError('request.not_found');
    }
    return member;
  }

  private async assertKeyFree(tx: Transaction, key: string): Promise<void> {
    if ((await tx.project.count({ where: { key } })) > 0) {
      throw keyTaken();
    }
  }

  /** A duplicate key that only the unique index caught (concurrent writes) is `key_taken` too. */
  private async withUniqueKey<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw keyTaken();
      }
      throw error;
    }
  }
}
