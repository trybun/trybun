import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { Injectable } from '@nestjs/common';
import {
  type AddOrganizationMemberInput,
  type CreateOrganizationInput,
  type ListOrganizationMembersQuery,
  type ListOrganizationsQuery,
  type Organization,
  type OrganizationAction,
  organizationActionSchema,
  type OrganizationMember,
  type OrganizationMemberPage,
  type OrganizationPage,
  type OrganizationSummary,
  type UpdateOrganizationDto,
} from '@trybun/contracts/organizations';
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
import {
  AuditLogEntriesService,
  type AuditLogEntryInput,
} from '../audit-log-entries/audit-log-entries.service.js';
import { domainFieldErrors, emailDomain, parseDomains } from './domain/email-domains.js';
import { CREATE, ORGANIZATION } from './organizations.abilities.js';
import {
  findAccountByEmail,
  isOrganizationNameTaken,
  lockOrganizationForShare,
} from './organizations.sql.js';

const SUMMARY_SELECT = {
  id: true,
  name: true,
  state: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  domains: { select: { domain: true }, orderBy: { domain: 'asc' } },
  _count: { select: { members: true } },
} satisfies Prisma.OrganizationSelect;

const DETAIL_SELECT = {
  ...SUMMARY_SELECT,
  projects: {
    select: { project: { select: { id: true, key: true, name: true, state: true } } },
    orderBy: { project: { key: 'asc' } },
  },
} satisfies Prisma.OrganizationSelect;

type SummaryRow = Prisma.OrganizationGetPayload<{ select: typeof SUMMARY_SELECT }>;
type DetailRow = Prisma.OrganizationGetPayload<{ select: typeof DETAIL_SELECT }>;

/** The response shape of an organization in a list (§18.3) with the principal's actions on it. */
function toSummaryResponse(row: SummaryRow, ability: AppAbility): OrganizationSummary {
  const record = subject(ORGANIZATION, { id: row.id, state: row.state });
  return {
    id: row.id,
    name: row.name,
    state: row.state,
    domains: row.domains.map(({ domain }) => domain),
    memberCount: row._count.members,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    allowedActions: organizationActionSchema.options.filter((action) =>
      ability.can(action, record),
    ),
  };
}

/** The response shape of an organization with the projects it may access (§18.3). */
function toOrganizationResponse(row: DetailRow, ability: AppAbility): Organization {
  return {
    ...toSummaryResponse(row, ability),
    projects: row.projects.map(({ project }) => ({
      id: project.id,
      key: project.key,
      name: project.name,
    })),
  };
}

const MEMBER_SELECT = {
  createdAt: true,
  user: { select: { id: true, displayName: true, email: true, state: true } },
} satisfies Prisma.OrganizationMemberSelect;

type MemberRow = Prisma.OrganizationMemberGetPayload<{ select: typeof MEMBER_SELECT }>;

/** The response shape of a member (§18.3); the Administrator sees the e-mail address. */
function toMemberResponse(row: MemberRow): OrganizationMember {
  return { user: row.user, createdAt: row.createdAt.toISOString() };
}

/** Organizations are sorted by name, then ID. */
const organizationSortKeySchema = z.tuple([z.string(), z.uuid()]);

/** Members are sorted by display name – accounts without one last – then ID. */
const memberSortKeySchema = z.tuple([z.string().nullable(), z.uuid()]);

/** The members after a cursor of the order by display name (nulls last), then ID. */
function membersAfter(after: z.infer<typeof memberSortKeySchema> | null): Prisma.UserWhereInput {
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

function nameTaken(): AppError {
  return new AppError('organization.name_taken', [{ pointer: '/name', code: 'field.invalid' }]);
}

/** The action and the details of an audit entry on an organization. */
type OrganizationAuditEntry =
  Extract<AuditLogEntryInput, { action: `organization.${string}` }> extends infer Entry
    ? Entry extends AuditLogEntryInput
      ? Omit<Entry, 'actorId' | 'target'>
      : never
    : never;

/** An added member: `isNew` is `false` when the account was a member already (§7.3). */
export interface AddedMember {
  member: OrganizationMember;
  isNew: boolean;
}

/** The organization an invited e-mail address joins (§7.3). */
export interface InvitationOrganization {
  id: string;
  name: string;
}

/**
 * Organizations (§7.3): their e-mail domains, the projects they may access and their members.
 * Each use case is one transaction (§18.3); the target record guard has already checked the
 * action on the organization, and every change re-checks it on the organization read inside its
 * transaction.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
    private readonly auditLog: AuditLogEntriesService,
  ) {}

  /** The organizations in one state, sorted by name; `projectId` keeps those with its access. */
  async list(principal: UserPrincipal, query: ListOrganizationsQuery): Promise<OrganizationPage> {
    const ability = this.visibleAbility(principal);
    const after = decodeCursor(query.cursor, organizationSortKeySchema);
    const rows = await this.prisma.organization.findMany({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType(ORGANIZATION),
          { state: query.state },
          query.projectId === undefined
            ? {}
            : { projects: { some: { projectId: query.projectId } } },
          after === null
            ? {}
            : { OR: [{ name: { gt: after[0] } }, { name: after[0], id: { gt: after[1] } }] },
        ],
      },
      select: SUMMARY_SELECT,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
    });
    return toPage(
      rows,
      query.limit,
      (row) => toSummaryResponse(row, ability),
      (row) => [row.name, row.id],
    );
  }

  async findOne(principal: UserPrincipal, organizationId: string): Promise<Organization> {
    const ability = this.abilities.forPrincipal(principal);
    return toOrganizationResponse(
      await this.findVisible(this.prisma, ability, organizationId),
      ability,
    );
  }

  /**
   * Creates an organization with its e-mail domains (§7.3); an audit entry for the organization
   * and one for each domain.
   */
  async create(principal: UserPrincipal, input: CreateOrganizationInput): Promise<Organization> {
    const ability = this.visibleAbility(principal);
    if (!ability.can(CREATE, ORGANIZATION)) {
      throw new AppError('request.forbidden');
    }
    const domains = parseDomains(input.domains);
    return this.withUniqueRules(() =>
      this.prisma.$transaction(async (tx) => {
        if (await isOrganizationNameTaken(tx, input.name, null)) {
          throw nameTaken();
        }
        await this.assertDomainsFree(tx, domains, null);
        const { id } = await tx.organization.create({
          data: { name: input.name },
          select: { id: true },
        });
        await this.record(tx, principal, id, { action: 'organization.created' });
        await this.addDomains(tx, principal, id, new Set(domains));
        return toOrganizationResponse(await this.findVisible(tx, ability, id), ability);
      }),
    );
  }

  /**
   * Changes the name, the e-mail domains (`update`) and the projects (`manage_projects`); a list
   * replaces the whole set, with an audit entry for each added and removed element (§7.3). Every
   * change increments the version.
   */
  async update(
    principal: UserPrincipal,
    target: VersionedTarget,
    input: UpdateOrganizationDto,
  ): Promise<Organization> {
    const ability = this.abilities.forPrincipal(principal);
    const domains = input.domains === undefined ? undefined : parseDomains(input.domains);
    return this.withUniqueRules(() =>
      this.prisma.$transaction(async (tx) => {
        const row = await this.findVisible(tx, ability, target.id);
        if (input.name !== undefined || domains !== undefined) {
          this.assertCan(ability, 'update', row);
        }
        if (input.projectIds !== undefined) {
          this.assertCan(ability, 'manage_projects', row);
        }
        const isRenamed = input.name !== undefined && input.name !== row.name;
        if (isRenamed && (await isOrganizationNameTaken(tx, input.name ?? '', target.id))) {
          throw nameTaken();
        }
        assertVersionMatched(
          await tx.organization.updateMany(
            versionedUpdate(target, input.name === undefined ? {} : { name: input.name }),
          ),
        );
        if (isRenamed) {
          await this.record(tx, principal, target.id, { action: 'organization.renamed' });
        }
        if (domains !== undefined) {
          await this.replaceDomains(tx, principal, row, domains);
        }
        if (input.projectIds !== undefined) {
          await this.replaceProjects(tx, ability, principal, row, input.projectIds);
        }
        return toOrganizationResponse(await this.findVisible(tx, ability, target.id), ability);
      }),
    );
  }

  /**
   * Archives an organization: read-only until it is unarchived; its domains stay reserved and do
   * not match (§7.3). Revoking its pending invitations arrives with S1-03.
   */
  async archive(principal: UserPrincipal, target: VersionedTarget): Promise<Organization> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      this.assertCan(ability, 'archive', await this.findVisible(tx, ability, target.id));
      assertVersionMatched(
        await tx.organization.updateMany(versionedUpdate(target, { state: 'archived' })),
      );
      await this.record(tx, principal, target.id, { action: 'organization.archived' });
      return toOrganizationResponse(await this.findVisible(tx, ability, target.id), ability);
    });
  }

  /**
   * Unarchives an organization (§7.3). An active organization stays unchanged, without an audit
   * entry; its `If-Match` is still checked.
   */
  async unarchive(principal: UserPrincipal, target: VersionedTarget): Promise<void> {
    const ability = this.abilities.forPrincipal(principal);
    await this.prisma.$transaction(async (tx) => {
      const row = await this.findVisible(tx, ability, target.id);
      this.assertCan(ability, 'unarchive', row);
      if (row.state === 'active') {
        assertVersionMatched({ count: row.version === target.version ? 1 : 0 });
        return;
      }
      assertVersionMatched(
        await tx.organization.updateMany(versionedUpdate(target, { state: 'active' })),
      );
      await this.record(tx, principal, target.id, { action: 'organization.unarchived' });
    });
  }

  /**
   * Deletes an organization with its domains, project access and memberships (§7.3): an audit
   * entry for each removed member and one for the deletion. The members keep their accounts and
   * their personal project access. Organizations with tickets are kept by the foreign key of the
   * ticket snapshot (S1-05), answered with `organization.not_empty`.
   */
  async delete(principal: UserPrincipal, target: VersionedTarget): Promise<void> {
    const ability = this.abilities.forPrincipal(principal);
    await this.prisma.$transaction(async (tx) => {
      this.assertCan(ability, 'delete', await this.findVisible(tx, ability, target.id));
      const members = await tx.organizationMember.findMany({
        where: { organizationId: target.id },
        select: { userId: true },
        orderBy: { userId: 'asc' },
      });
      assertVersionMatched(await tx.organization.deleteMany({ where: versionedWhere(target) }));
      for (const { userId } of members) {
        await this.record(tx, principal, target.id, {
          action: 'organization.member_removed',
          details: { userId },
        });
      }
      await this.record(tx, principal, target.id, { action: 'organization.deleted' });
    });
  }

  /** The members of an organization, sorted by display name. */
  async listMembers(
    principal: UserPrincipal,
    organizationId: string,
    query: ListOrganizationMembersQuery,
  ): Promise<OrganizationMemberPage> {
    const ability = this.abilities.forPrincipal(principal);
    const after = decodeCursor(query.cursor, memberSortKeySchema);
    const rows = await this.prisma.organizationMember.findMany({
      where: {
        AND: [
          { organization: accessibleBy(ability, 'read').ofType(ORGANIZATION) },
          { organizationId, user: membersAfter(after) },
        ],
      },
      select: MEMBER_SELECT,
      orderBy: [{ user: { displayName: { sort: 'asc', nulls: 'last' } } }, { user: { id: 'asc' } }],
      take: query.limit + 1,
    });
    return toPage(rows, query.limit, toMemberResponse, (row) => [
      row.user.displayName,
      row.user.id,
    ]);
  }

  /**
   * Adds an end-user account to an organization by its e-mail address (§7.3). An account of
   * another organization is moved only with `move`, in one transaction with two audit entries; an
   * account that is a member already stays unchanged, without an audit entry.
   */
  async addMember(
    principal: UserPrincipal,
    organizationId: string,
    input: AddOrganizationMemberInput,
  ): Promise<AddedMember> {
    const ability = this.abilities.forPrincipal(principal);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockForMembership(tx, ability, organizationId);
        const account = await findAccountByEmail(tx, input.email);
        if (account === null) {
          throw new AppError('organization.member_not_found', [
            { pointer: '/email', code: 'field.invalid' },
          ]);
        }
        if (account.kind !== 'end_user') {
          throw new AppError('organization.member_not_end_user', [
            { pointer: '/email', code: 'field.invalid' },
          ]);
        }
        const current = await tx.organizationMember.findUnique({
          where: { userId: account.id },
          select: { ...MEMBER_SELECT, organizationId: true },
        });
        if (current?.organizationId === organizationId) {
          return { member: toMemberResponse(current), isNew: false };
        }
        if (current !== null) {
          if (!input.move) {
            throw new AppError('organization.member_of_other_organization');
          }
          // Moving changes the old organization too, which an archive keeps unchanged (§7.3).
          await this.lockForMembership(tx, ability, current.organizationId);
          await this.deleteMembership(tx, principal, account.id, current.organizationId);
        }
        const row = await tx.organizationMember.create({
          data: { userId: account.id, organizationId },
          select: MEMBER_SELECT,
        });
        await this.record(tx, principal, organizationId, {
          action: 'organization.member_added',
          details: { userId: account.id },
        });
        return { member: toMemberResponse(row), isNew: true };
      });
    } catch (error) {
      // A concurrent addition of the account to another organization met the primary key.
      if (isUniqueViolation(error)) {
        throw new AppError('organization.member_of_other_organization');
      }
      throw error;
    }
  }

  /** Removes a member from an organization (§7.3); `404` when the account is not a member. */
  async removeMember(
    principal: UserPrincipal,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const ability = this.abilities.forPrincipal(principal);
    await this.prisma.$transaction(async (tx) => {
      await this.lockForMembership(tx, ability, organizationId);
      const member = await tx.organizationMember.findFirst({
        where: { userId, organizationId },
        select: { userId: true },
      });
      if (member === null) {
        throw new AppError('request.not_found');
      }
      await this.deleteMembership(tx, principal, userId, organizationId);
    });
  }

  /**
   * Ends the membership of an account as a consequence of a change of the account – the kind
   * change to `team` (§7.1) and anonymization (S1-16) – also in an archived organization (§7.3).
   * Without a membership nothing changes.
   */
  async removeMembership(tx: Transaction, principal: UserPrincipal, userId: string): Promise<void> {
    const member = await tx.organizationMember.findUnique({
      where: { userId },
      select: { organizationId: true },
    });
    if (member !== null) {
      await this.deleteMembership(tx, principal, userId, member.organizationId);
    }
  }

  /**
   * The organization an invited e-mail address joins (§7.3, used by S1-03): the active
   * organization whose domain equals the domain of the address exactly and that may access the
   * inviting project; `null` otherwise.
   */
  async findForInvitation(
    tx: Transaction,
    email: string,
    projectId: string,
  ): Promise<InvitationOrganization | null> {
    const domain = emailDomain(email);
    if (domain === null) {
      return null;
    }
    const row = await tx.organizationDomain.findFirst({
      where: {
        domain,
        organization: { state: 'active', projects: { some: { projectId } } },
      },
      select: { organization: { select: { id: true, name: true } } },
    });
    return row?.organization ?? null;
  }

  /**
   * The ability of a principal for the organizations as a whole: for whom they are invisible, the
   * list and the creation answer `404` like their records (§7.5).
   */
  private visibleAbility(principal: UserPrincipal): AppAbility {
    const ability = this.abilities.forPrincipal(principal);
    if (!ability.can('read', ORGANIZATION)) {
      throw new AppError('request.not_found');
    }
    return ability;
  }

  /**
   * An organization the principal can see, through the `read` filter of the ability: `404`
   * otherwise (§17.2).
   */
  private async findVisible(
    db: Transaction,
    ability: AppAbility,
    organizationId: string,
    action?: OrganizationAction,
  ): Promise<DetailRow> {
    const row = await db.organization.findFirst({
      where: { AND: [accessibleBy(ability, 'read').ofType(ORGANIZATION), { id: organizationId }] },
      select: DETAIL_SELECT,
    });
    if (row === null) {
      throw new AppError('request.not_found');
    }
    if (action !== undefined) {
      this.assertCan(ability, action, row);
    }
    return row;
  }

  /** `403`, or the code of the denying rule (e.g. `409 organization.archived`). */
  private assertCan(ability: AppAbility, action: OrganizationAction, row: DetailRow): void {
    const record = subject(ORGANIZATION, { id: row.id, state: row.state });
    if (!ability.can(action, record)) {
      throw new AppError(reasonCode(ability.relevantRuleFor(action, record)?.reason));
    }
  }

  /**
   * Memberships are not versioned: a membership change locks the organization row and re-reads
   * it, so no member changes in an organization archived concurrently (§7.3).
   */
  private async lockForMembership(
    tx: Transaction,
    ability: AppAbility,
    organizationId: string,
  ): Promise<void> {
    if (!(await lockOrganizationForShare(tx, organizationId))) {
      throw new AppError('request.not_found');
    }
    await this.findVisible(tx, ability, organizationId, 'manage_members');
  }

  private async deleteMembership(
    tx: Transaction,
    principal: UserPrincipal,
    userId: string,
    organizationId: string,
  ): Promise<void> {
    await tx.organizationMember.delete({ where: { userId } });
    await this.record(tx, principal, organizationId, {
      action: 'organization.member_removed',
      details: { userId },
    });
  }

  /** `409 organization.domain_taken` at the field of each domain of another organization. */
  private async assertDomainsFree(
    tx: Transaction,
    domains: readonly string[],
    organizationId: string | null,
  ): Promise<void> {
    if (domains.length === 0) {
      return;
    }
    const taken = await tx.organizationDomain.findMany({
      where: {
        domain: { in: [...domains] },
        ...(organizationId === null ? {} : { organizationId: { not: organizationId } }),
      },
      select: { domain: true },
    });
    const takenDomains = new Set(taken.map(({ domain }) => domain));
    const errors = domainFieldErrors(domains, (domain) => takenDomains.has(domain));
    if (errors.length > 0) {
      throw new AppError('organization.domain_taken', errors);
    }
  }

  private async addDomains(
    tx: Transaction,
    principal: UserPrincipal,
    organizationId: string,
    domains: ReadonlySet<string>,
  ): Promise<void> {
    for (const domain of domains) {
      await tx.organizationDomain.create({
        data: { organizationId, domain },
        select: { id: true },
      });
      await this.record(tx, principal, organizationId, {
        action: 'organization.domain_added',
        details: { domain },
      });
    }
  }

  /** Replaces the domains of an organization; members never move with them (§7.3). */
  private async replaceDomains(
    tx: Transaction,
    principal: UserPrincipal,
    row: DetailRow,
    domains: readonly string[],
  ): Promise<void> {
    await this.assertDomainsFree(tx, domains, row.id);
    const wanted = new Set(domains);
    const current = new Set(row.domains.map(({ domain }) => domain));
    const removed = [...current].filter((domain) => !wanted.has(domain));
    if (removed.length > 0) {
      await tx.organizationDomain.deleteMany({
        where: { organizationId: row.id, domain: { in: removed } },
      });
    }
    for (const domain of removed) {
      await this.record(tx, principal, row.id, {
        action: 'organization.domain_removed',
        details: { domain },
      });
    }
    await this.addDomains(
      tx,
      principal,
      row.id,
      new Set([...wanted].filter((domain) => !current.has(domain))),
    );
  }

  /**
   * Replaces the projects an organization may access (§7.3). A project that is not visible is
   * `404` (§17.2); granting or removing the access to an archived project `409 project.archived`.
   */
  private async replaceProjects(
    tx: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    row: DetailRow,
    projectIds: readonly string[],
  ): Promise<void> {
    const wanted = new Set(projectIds);
    const current = new Map(row.projects.map(({ project }) => [project.id, project.state]));
    const added = [...wanted].filter((projectId) => !current.has(projectId));
    const removed = [...current.keys()].filter((projectId) => !wanted.has(projectId));
    const projects = await tx.project.findMany({
      where: { AND: [accessibleBy(ability, 'read').ofType('Project'), { id: { in: added } }] },
      select: { id: true, state: true },
    });
    if (projects.length < added.length) {
      throw new AppError('request.not_found');
    }
    if (
      projects.some(({ state }) => state === 'archived') ||
      removed.some((projectId) => current.get(projectId) === 'archived')
    ) {
      throw new AppError('project.archived');
    }
    if (removed.length > 0) {
      await tx.organizationProject.deleteMany({
        where: { organizationId: row.id, projectId: { in: removed } },
      });
    }
    for (const projectId of removed) {
      await this.record(tx, principal, row.id, {
        action: 'organization.project_removed',
        details: { projectId },
      });
    }
    for (const projectId of added) {
      await tx.organizationProject.create({
        data: { organizationId: row.id, projectId },
        select: { projectId: true },
      });
      await this.record(tx, principal, row.id, {
        action: 'organization.project_added',
        details: { projectId },
      });
    }
  }

  /** An audit entry of the principal on an organization (§13.5), its actor and target added. */
  private record(
    tx: Transaction,
    principal: UserPrincipal,
    organizationId: string,
    entry: OrganizationAuditEntry,
  ): Promise<void> {
    return this.auditLog.record(tx, {
      ...entry,
      actorId: principal.userId,
      target: { type: ORGANIZATION, id: organizationId },
    });
  }

  /**
   * A duplicate that only a unique index caught – concurrent writes – answered with the code of
   * its rule (§18.3): a domain of another organization, otherwise the name.
   */
  private async withUniqueRules<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error, 'organization_domains_domain_key')) {
        throw new AppError('organization.domain_taken');
      }
      if (isUniqueViolation(error, 'organizations_name_lower_key')) {
        throw nameTaken();
      }
      throw error;
    }
  }
}
