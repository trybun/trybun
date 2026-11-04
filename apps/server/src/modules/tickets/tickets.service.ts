import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { Injectable } from '@nestjs/common';
import type { ActivityEventPage, ListActivityEventsQuery } from '@trybun/contracts/activity-events';
import {
  type CreateTicketDto,
  type EndUserTicket,
  type ListTicketsQuery,
  type Ticket,
  type TicketAction,
  ticketActionSchema,
  ticketIdentifier,
  type TicketPage,
  type TicketResponse,
  type UpdateTicketDto,
} from '@trybun/contracts/tickets';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory, type AppAbility } from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import { teamRolesFrom } from '../../platform/authorization/project-roles.js';
import { decodeCursor, toPage } from '../../platform/database/cursor.js';
import {
  assertVersionMatched,
  type VersionedTarget,
  versionedUpdate,
} from '../../platform/database/optimistic-locking.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { AppError } from '../../platform/errors/app-error.js';
import { ActivityEventsService } from '../activity-events/activity-events.service.js';
import type { TrackedTicketFields } from '../activity-events/domain/field-changes.js';
import { PROJECT, projectRuleSelect } from '../projects/projects.abilities.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { UsersService } from '../users/users.service.js';
import { creationDefaults } from './domain/creation.js';
import { CREATE_TICKET, TICKET, ticketRuleSelect } from './tickets.abilities.js';
import { allocateTicketNumber } from './tickets.sql.js';

const PERSON_SELECT = { id: true, displayName: true } satisfies Prisma.UserSelect;

/** The fields of a ticket response and of its rules (§18.3). */
function ticketSelect(principal: UserPrincipal) {
  return {
    ...ticketRuleSelect(principal),
    project: { select: { ...projectRuleSelect(principal), key: true } },
    projectId: true,
    number: true,
    title: true,
    description: true,
    type: true,
    source: true,
    priority: true,
    status: true,
    version: true,
    createdAt: true,
    updatedAt: true,
    organization: { select: { id: true, name: true } },
    requester: { select: PERSON_SELECT },
    assignee: { select: PERSON_SELECT },
  } satisfies Prisma.TicketSelect;
}

type TicketRow = Prisma.TicketGetPayload<{ select: ReturnType<typeof ticketSelect> }>;

/**
 * The response shape of a ticket (§18.3) with the actions the principal may perform on it: the
 * team's shape for a team account, the end user's – without the team's fields (§3.2) – for an end
 * user.
 */
function toTicketResponse(
  row: TicketRow,
  ability: AppAbility,
  principal: UserPrincipal,
): TicketResponse {
  const record = subject(TICKET, row);
  const endUserTicket: EndUserTicket = {
    id: row.id,
    projectId: row.projectId,
    number: row.number,
    identifier: ticketIdentifier(row.project.key, row.number),
    title: row.title,
    description: row.description,
    requester: row.requester,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    allowedActions: ticketActionSchema.options.filter((action) => ability.can(action, record)),
  };
  if (principal.userKind === 'end_user') {
    return endUserTicket;
  }
  return {
    ...endUserTicket,
    type: row.type,
    source: row.source,
    priority: row.priority,
    status: row.status,
    organization: row.organization,
    assignee: row.assignee,
  } satisfies Ticket;
}

/** The fields of a ticket the activity history records (§4.5). */
function trackedFields(row: TicketRow): TrackedTicketFields {
  return {
    title: row.title,
    description: row.description,
    type: row.type,
    priority: row.priority,
    assignee: row.assignee,
  };
}

/** Tickets of one project are listed by number; others by creation, newest first. */
const numberSortKeySchema = z.tuple([z.int()]);
const creationSortKeySchema = z.tuple([z.iso.datetime(), z.uuid()]);

function assigneeNotEligible(): AppError {
  return new AppError('ticket.assignee_not_eligible', [
    { pointer: '/assigneeId', code: 'field.invalid' },
  ]);
}

/**
 * Tickets (§3.2): creation with the next number of the project, reading, and changes of their
 * fields, each recorded in the activity history (§4.5). Each use case is one transaction (§18.3);
 * the target record guard has already checked the action on the ticket, and every change re-checks
 * it on the ticket read inside its transaction.
 */
@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
    private readonly projects: ProjectsService,
    private readonly users: UsersService,
    private readonly organizations: OrganizationsService,
    private readonly activityEvents: ActivityEventsService,
  ) {}

  /**
   * Creates a ticket (§3.2). The project is locked in share mode and read through the ability
   * after the lock, so a concurrent archive, key change or deletion – which lock it exclusively –
   * either waits or is seen; concurrent creations do not block each other on it, and get
   * consecutive numbers from the counter. Creating writes no activity event (§4.5).
   */
  async create(principal: UserPrincipal, input: CreateTicketDto): Promise<TicketResponse> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      if (!(await this.projects.lockForShare(tx, input.projectId))) {
        throw new AppError('request.not_found');
      }
      const project = await tx.project.findFirst({
        where: { AND: [accessibleBy(ability, 'read').ofType(PROJECT), { id: input.projectId }] },
        select: projectRuleSelect(principal),
      });
      if (project === null) {
        throw new AppError('request.not_found');
      }
      const projectRecord = subject(PROJECT, project);
      if (!ability.can(CREATE_TICKET, projectRecord)) {
        throw new AppError(
          reasonCode(ability.relevantRuleFor(CREATE_TICKET, projectRecord)?.reason),
        );
      }
      // The fields of the full form belong to the team (§7.5): nothing is created.
      const isFullForm =
        input.type !== undefined || input.priority !== undefined || input.assigneeId !== undefined;
      if (principal.userKind === 'end_user' && isFullForm) {
        throw new AppError('request.forbidden');
      }
      const assigneeId = input.assigneeId ?? null;
      if (assigneeId !== null) {
        const newTicket = subject(TICKET, { id: '', requesterId: principal.userId, project });
        this.assertMayAssign(ability, newTicket, principal, null, assigneeId);
        await this.assertEligibleAssignee(tx, project.id, assigneeId);
      }
      const organizationId = await this.lockOrganizationSnapshot(tx, principal.userId);
      const number = await allocateTicketNumber(tx, project.id);
      const row = await tx.ticket.create({
        data: {
          projectId: project.id,
          number,
          title: input.title,
          description: input.description ?? '',
          ...creationDefaults(principal.userKind, input),
          // The requester's organization at creation, whatever its state (§3.2).
          organizationId,
          requesterId: principal.userId,
          assigneeId,
        },
        select: ticketSelect(principal),
      });
      return toTicketResponse(row, ability, principal);
    });
  }

  /**
   * The tickets the principal can see, newest first: by number within a project. `identifier`
   * finds the one ticket with it, or none when it is invisible.
   */
  async list(principal: UserPrincipal, query: ListTicketsQuery): Promise<TicketPage> {
    const ability = this.abilities.forPrincipal(principal);
    const filters: Prisma.TicketWhereInput[] = [accessibleBy(ability, 'read').ofType(TICKET)];
    if (query.projectId !== undefined) {
      filters.push({ projectId: query.projectId });
    }
    if (query.identifier !== undefined) {
      const separator = query.identifier.lastIndexOf('-');
      filters.push({
        project: { is: { key: query.identifier.slice(0, separator) } },
        number: Number(query.identifier.slice(separator + 1)),
      });
    }
    const select = ticketSelect(principal);
    const toItem = (row: TicketRow) => toTicketResponse(row, ability, principal);
    if (query.projectId !== undefined) {
      const after = decodeCursor(query.cursor, numberSortKeySchema);
      const rows = await this.prisma.ticket.findMany({
        where: { AND: [...filters, after === null ? {} : { number: { lt: after[0] } }] },
        select,
        orderBy: { number: 'desc' },
        take: query.limit + 1,
      });
      return toPage(rows, query.limit, toItem, (row) => [row.number]);
    }
    const after = decodeCursor(query.cursor, creationSortKeySchema);
    const rows = await this.prisma.ticket.findMany({
      where: {
        AND: [
          ...filters,
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
      select,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return toPage(rows, query.limit, toItem, (row) => [row.createdAt.toISOString(), row.id]);
  }

  async findOne(principal: UserPrincipal, ticketId: string): Promise<TicketResponse> {
    const ability = this.abilities.forPrincipal(principal);
    const row = await this.findVisible(this.prisma, ability, principal, ticketId);
    return toTicketResponse(row, ability, principal);
  }

  /**
   * Changes the fields of a ticket (§3.2). A body with a field the principal may not change is
   * rejected as a whole with `403` (§18.3); the project never changes. Every changed field writes
   * its activity event in the same transaction (§4.5); a body that changes nothing writes none and
   * keeps the version, after checking it.
   */
  async update(
    principal: UserPrincipal,
    target: VersionedTarget,
    input: UpdateTicketDto,
  ): Promise<TicketResponse> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findVisible(tx, ability, principal, target.id);
      const record = subject(TICKET, before);
      if (input.title !== undefined || input.description !== undefined) {
        this.assertCan(ability, 'update', before);
      }
      if (input.type !== undefined || input.priority !== undefined) {
        this.assertCan(ability, 'update_fields', before);
      }
      // `null` and no assignee are the same: unassigning an unassigned ticket changes nothing.
      const currentAssigneeId = before.assignee?.id ?? null;
      const isReassigned = input.assigneeId !== undefined && input.assigneeId !== currentAssigneeId;
      if (isReassigned) {
        this.assertMayAssign(
          ability,
          record,
          principal,
          currentAssigneeId,
          input.assigneeId ?? null,
        );
      }
      if (input.projectId !== undefined && input.projectId !== before.projectId) {
        throw new AppError('ticket.project_immutable', [
          { pointer: '/projectId', code: 'field.invalid' },
        ]);
      }
      if (isReassigned && input.assigneeId != null) {
        await this.assertEligibleAssignee(tx, before.projectId, input.assigneeId);
      }
      const data = {
        ...(input.title !== undefined && input.title !== before.title
          ? { title: input.title }
          : {}),
        ...(input.description !== undefined && input.description !== before.description
          ? { description: input.description }
          : {}),
        ...(input.type !== undefined && input.type !== before.type ? { type: input.type } : {}),
        ...(input.priority !== undefined && input.priority !== before.priority
          ? { priority: input.priority }
          : {}),
        ...(isReassigned ? { assigneeId: input.assigneeId ?? null } : {}),
      } satisfies Prisma.TicketUncheckedUpdateManyInput;
      if (Object.keys(data).length === 0) {
        assertVersionMatched({ count: before.version === target.version ? 1 : 0 });
        return toTicketResponse(before, ability, principal);
      }
      assertVersionMatched(await tx.ticket.updateMany(versionedUpdate(target, data)));
      const after = await this.findVisible(tx, ability, principal, target.id);
      await this.activityEvents.recordChanges(
        tx,
        { userId: principal.userId },
        target.id,
        trackedFields(before),
        trackedFields(after),
      );
      return toTicketResponse(after, ability, principal);
    });
  }

  /**
   * The activity events of a ticket the target record guard let the principal read, oldest first:
   * end users see only the public ones (§4.5).
   */
  listActivityEvents(
    principal: UserPrincipal,
    ticketId: string,
    query: ListActivityEventsQuery,
  ): Promise<ActivityEventPage> {
    return this.activityEvents.list(ticketId, query, {
      publicOnly: principal.userKind === 'end_user',
    });
  }

  /**
   * Who may set the assignee (§7.5): with `assign` anyone; with `assign_self` only the principal –
   * taking over a ticket included – or nobody instead of the principal. Otherwise `403`, or the
   * code of the denying rule (e.g. `409 project.archived`).
   */
  private assertMayAssign(
    ability: AppAbility,
    record: Parameters<AppAbility['can']>[1],
    principal: UserPrincipal,
    current: string | null,
    next: string | null,
  ): void {
    if (ability.can('assign', record)) {
      return;
    }
    const isSelf = next === principal.userId || (next === null && current === principal.userId);
    if (isSelf && ability.can('assign_self', record)) {
      return;
    }
    const action: TicketAction = isSelf ? 'assign_self' : 'assign';
    throw new AppError(reasonCode(ability.relevantRuleFor(action, record)?.reason));
  }

  /**
   * The organization of the requester for the snapshot of a new ticket (§3.2), locked in share
   * mode so that a concurrent deletion of the organization waits for the creation and then meets
   * the restricting foreign key of the snapshot (`409 organization.not_empty`), instead of failing
   * the creation. A deletion that committed first removed the membership: no snapshot.
   */
  private async lockOrganizationSnapshot(tx: Transaction, userId: string): Promise<string | null> {
    const membership = await tx.organizationMember.findUnique({
      where: { userId },
      select: { organizationId: true },
    });
    if (
      membership === null ||
      !(await this.organizations.lockForShare(tx, membership.organizationId))
    ) {
      return null;
    }
    const locked = await tx.organizationMember.findUnique({
      where: { userId },
      select: { organizationId: true },
    });
    return locked?.organizationId ?? null;
  }

  /**
   * The assignee must be an active team account with a team role in the project (§3.2):
   * `422 ticket.assignee_not_eligible` otherwise. The membership and the account are locked in
   * share mode first, so a concurrent removal or deactivation waits for the assignment, and its
   * unassignment then sees the new assignee.
   */
  private async assertEligibleAssignee(
    tx: Transaction,
    projectId: string,
    userId: string,
  ): Promise<void> {
    if (!(await this.projects.lockMemberForShare(tx, projectId, userId))) {
      throw assigneeNotEligible();
    }
    if (!(await this.users.lockForShare(tx, userId))) {
      throw assigneeNotEligible();
    }
    const eligible = await tx.projectMember.count({
      where: {
        projectId,
        userId,
        role: { in: teamRolesFrom('developer') },
        user: { kind: 'team', state: 'active' },
      },
    });
    if (eligible === 0) {
      throw assigneeNotEligible();
    }
  }

  /**
   * A ticket the principal can see, through the `read` filter of the ability: `404` otherwise
   * (§17.2).
   */
  private async findVisible(
    db: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    ticketId: string,
  ): Promise<TicketRow> {
    const row = await db.ticket.findFirst({
      where: { AND: [accessibleBy(ability, 'read').ofType(TICKET), { id: ticketId }] },
      select: ticketSelect(principal),
    });
    if (row === null) {
      throw new AppError('request.not_found');
    }
    return row;
  }

  /** `403`, or the code of the denying rule (e.g. `409 project.archived`). */
  private assertCan(ability: AppAbility, action: TicketAction, row: TicketRow): void {
    const record = subject(TICKET, row);
    if (!ability.can(action, record)) {
      throw new AppError(reasonCode(ability.relevantRuleFor(action, record)?.reason));
    }
  }
}
