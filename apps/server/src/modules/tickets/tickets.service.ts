import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { Injectable } from '@nestjs/common';
import type {
  ActivityEventPage,
  ActivityEventTicketSnapshot,
  ListActivityEventsQuery,
} from '@trybun/contracts/activity-events';
import {
  type ChangeTicketStatusDto,
  type ConfirmResolutionDto,
  type CreateTicketDto,
  type RejectTicketSharingDto,
  type SetTicketVisibilityDto,
  type EndUserTicket,
  type ListTicketsQuery,
  type Ticket,
  type TicketAction,
  ticketActionSchema,
  ticketIdentifier,
  type TicketPage,
  type TicketReference,
  type TicketResponse,
  publicStatusDescriptionOf,
  publicStatusOf,
  type UpdateTicketDto,
} from '@trybun/contracts/tickets';
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
} from '../../platform/database/optimistic-locking.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { Clock } from '../../platform/clock/clock.js';
import { AppError } from '../../platform/errors/app-error.js';
import { OutboxService } from '../../platform/outbox/outbox.service.js';
import {
  type ActivityActor,
  ActivityEventsService,
} from '../activity-events/activity-events.service.js';
import { AttachmentLinksService } from '../attachments/attachment-links.service.js';
import { AuditLogEntriesService } from '../audit-log-entries/audit-log-entries.service.js';
import { originalIdsOf, toEndUserEvent } from '../activity-events/domain/end-user-events.js';
import type { TrackedTicketFields } from '../activity-events/domain/field-changes.js';
import { ASSIGNABLE_MEMBER } from '../projects/assignable-members.js';
import { PROJECT, projectRuleSelect } from '../projects/projects.abilities.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { UsersService } from '../users/users.service.js';
import { creationDefaults } from './domain/creation.js';
import {
  answerTarget,
  automaticCloseDueAt,
  changeStatus,
  type StatusChange,
  statusFieldsOf,
  waitsForConfirmation,
} from './domain/status-transitions.js';
import {
  approveSharing,
  changeVisibility,
  initialVisibility,
  rejectSharing,
  type VisibilityChange,
  type VisibilityFields,
} from './domain/visibility.js';
import {
  CREATE_TICKET,
  CREATE_TICKET_ALL_CUSTOMERS,
  CREATE_TICKET_MY_ORGANIZATION,
  TICKET,
  ticketRuleSelect,
} from './tickets.abilities.js';
import { TICKET_STATUS_CHANGED, type TicketStatusChangedPayload } from './tickets.events.js';
import {
  allocateTicketNumber,
  listRequestedTicketKeys,
  lockTicketsForUpdate,
} from './tickets.sql.js';
import { identitySelect, visiblePerson } from './visible-person.js';

const PERSON_SELECT = { id: true, displayName: true } satisfies Prisma.UserSelect;

/** The fields of a ticket a reference to it shows, with the fields of its rules. */
function ticketReferenceSelect(principal: UserPrincipal) {
  return {
    ...ticketRuleSelect(principal),
    number: true,
    project: { select: { ...projectRuleSelect(principal), key: true } },
  } satisfies Prisma.TicketSelect;
}

/** The fields of a ticket response and of its rules (§18.3). */
function ticketSelect(principal: UserPrincipal) {
  return {
    ...ticketRuleSelect(principal),
    project: {
      select: { ...projectRuleSelect(principal), key: true, name: true, confirmResolution: true },
    },
    projectId: true,
    number: true,
    title: true,
    description: true,
    type: true,
    source: true,
    priority: true,
    status: true,
    statusBeforeWaiting: true,
    waitingSince: true,
    closedAt: true,
    rejectionReason: true,
    sharingRefusalReason: true,
    version: true,
    createdAt: true,
    updatedAt: true,
    organization: {
      select: { ...ticketRuleSelect(principal).organization.select, id: true, name: true },
    },
    requester: { select: identitySelect(principal) },
    assignee: { select: PERSON_SELECT },
    // At most one (§3.5): a partial unique index of the migrations.
    outgoingRelations: {
      where: { kind: 'duplicate_of' },
      select: { targetTicket: { select: ticketReferenceSelect(principal) } },
    },
  } satisfies Prisma.TicketSelect;
}

type TicketRow = Prisma.TicketGetPayload<{ select: ReturnType<typeof ticketSelect> }>;
type TicketReferenceRow = Prisma.TicketGetPayload<{
  select: ReturnType<typeof ticketReferenceSelect>;
}>;

/** The fields of a ticket the automatic close reads as the system (§4.3). */
function systemTicketSelect() {
  return {
    id: true,
    projectId: true,
    source: true,
    status: true,
    waitingReason: true,
    statusBeforeWaiting: true,
    waitingSince: true,
    closedAt: true,
    rejectionReason: true,
    version: true,
    assignee: { select: PERSON_SELECT },
    project: { select: { state: true, confirmResolution: true } },
  } satisfies Prisma.TicketSelect;
}

/** The fields of a ticket a status change writes from. */
type StatusChangeSubject = Pick<
  TicketRow,
  'id' | 'projectId' | 'status' | 'waitingReason' | 'waitingSince' | 'version' | 'assignee'
>;

/** How long the timer waits before it checks a ticket of an archived project again (Q19). */
export const ARCHIVED_PROJECT_RECHECK_MS = 24 * 60 * 60 * 1000;

/**
 * What the automatic close did: closed the ticket, had nothing to do, or has to check again –
 * before the ticket's time, or while its project is archived.
 */
export type AutomaticCloseOutcome =
  { outcome: 'closed' | 'skipped' } | { outcome: 'not_due' | 'archived'; checkAgainAt: Date };

/** A ticket as an event stores it (§4.5) and a response refers to it. */
function snapshotOf(row: TicketReferenceRow): ActivityEventTicketSnapshot {
  return { id: row.id, number: row.number, projectKey: row.project.key };
}

/** The original of a duplicate, when there is one. */
function originalOf(row: TicketRow): TicketReferenceRow | null {
  return row.outgoingRelations[0]?.targetTicket ?? null;
}

/** The original of a duplicate in a response: only when the principal may read it (§3.5). */
function duplicateOfResponse(row: TicketRow, ability: AppAbility): TicketReference | null {
  const original = originalOf(row);
  return original !== null && ability.can('read', subject(TICKET, original))
    ? snapshotOf(original)
    : null;
}

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
  const commonFields = {
    id: row.id,
    projectId: row.projectId,
    // The project's own read rules do not apply: the reference goes with the ticket (Q19).
    project: { id: row.project.id, key: row.project.key, name: row.project.name },
    number: row.number,
    identifier: ticketIdentifier(row.project.key, row.number),
    title: row.title,
    description: row.description,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    allowedActions: ticketActionSchema.options.filter((action) => ability.can(action, record)),
    publicStatus: publicStatusOf(row.status),
    waitingReason: row.waitingReason,
    duplicateOf: duplicateOfResponse(row, ability),
    visibility: row.visibility,
    sharingRequest: row.sharingRequest,
  };
  if (principal.userKind === 'end_user') {
    return {
      ...commonFields,
      requester: visiblePerson(principal, row.requester),
      publicStatusDescription: publicStatusDescriptionOf(row.status, row.waitingReason),
    } satisfies EndUserTicket;
  }
  return {
    ...commonFields,
    requester: { id: row.requester.id, displayName: row.requester.displayName },
    type: row.type,
    source: row.source,
    priority: row.priority,
    status: row.status,
    organization:
      row.organization === null ? null : { id: row.organization.id, name: row.organization.name },
    assignee: row.assignee,
    closedAt: row.closedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    sharingRefusalReason: row.sharingRefusalReason,
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

/** The visibility fields of a ticket (S1-11). */
function visibilityFieldsOf(row: TicketRow): VisibilityFields {
  return {
    visibility: row.visibility,
    sharingRequest: row.sharingRequest,
    sharingRefusalReason: row.sharingRefusalReason,
  };
}

/** Tickets of one project are listed by number; others by creation, newest first. */
const numberSortKeySchema = z.tuple([z.int()]);
const creationSortKeySchema = z.tuple([z.iso.datetime(), z.uuid()]);
/** "My tickets" are listed awaiting the requester's reply first, then by update, then by ID. */
const requestedSortKeySchema = z.tuple([z.boolean(), z.iso.datetime(), z.uuid()]);

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
    private readonly auditLog: AuditLogEntriesService,
    private readonly attachmentLinks: AttachmentLinksService,
    private readonly outbox: OutboxService,
    private readonly clock: Clock,
  ) {}

  /**
   * Creates a ticket (§3.2). The project is locked in share mode and read through the ability
   * after the lock, so a concurrent archive, key change or deletion – which lock it exclusively –
   * either waits or is seen; concurrent creations do not block each other on it, and get
   * consecutive numbers from the counter. The principal's drafts in `attachmentIds` are linked to
   * it in the same transaction (§3.2). Creating writes no activity event (§4.5, S1-08 Q16).
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
      // A visibility other than `only_me` needs its project action (S1-11 Q7); team tickets are
      // `only_me` (Q6). Nothing is created without it.
      const requested = input.visibility ?? 'only_me';
      const canChooseOrganization = ability.can(CREATE_TICKET_MY_ORGANIZATION, projectRecord);
      if (
        (requested === 'my_organization' && !canChooseOrganization) ||
        (requested === 'all_customers' && !ability.can(CREATE_TICKET_ALL_CUSTOMERS, projectRecord))
      ) {
        throw new AppError('request.forbidden');
      }
      const visibility = initialVisibility(requested, canChooseOrganization);
      const assigneeId = input.assigneeId ?? null;
      if (assigneeId !== null) {
        const newTicket = subject(TICKET, { id: '', requesterId: principal.userId, project });
        this.assertMayAssign(ability, newTicket, principal, null, assigneeId);
        await this.assertEligibleAssignee(tx, project.id, assigneeId);
      }
      const organizationId = await this.lockOrganizationSnapshot(tx, principal.userId);
      // The person left their organization since the project was read (Q4).
      if (visibility.visibility === 'my_organization' && organizationId === null) {
        throw new AppError('ticket.organization_changed');
      }
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
          ...visibility,
          requesterId: principal.userId,
          assigneeId,
        },
        select: ticketSelect(principal),
      });
      await this.attachmentLinks.linkDrafts(tx, principal, row.id, input.attachmentIds ?? []);
      return toTicketResponse(row, ability, principal);
    });
  }

  /**
   * The tickets the principal can see, newest first: by number within a project. `identifier`
   * finds the one ticket with it, or none when it is invisible; `involvement=mine` lists the
   * tickets the principal requested in the order of "My tickets".
   */
  async list(principal: UserPrincipal, query: ListTicketsQuery): Promise<TicketPage> {
    const ability = this.abilities.forPrincipal(principal);
    if (query.involvement === 'mine') {
      return this.listRequested(principal, ability, query);
    }
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

  /**
   * "My tickets" (`involvement=mine`, §5.7, Q10): the tickets the principal requested, awaiting
   * their reply first. The order comes from raw SQL by the requester alone; the records are then
   * loaded through the `read` filter of the ability, so a ticket the principal may no longer read
   * – a team member's ticket in a project they left – leaves a page shorter than `limit`, while
   * the cursor still follows the last key of the SQL.
   */
  private async listRequested(
    principal: UserPrincipal,
    ability: AppAbility,
    query: ListTicketsQuery,
  ): Promise<TicketPage> {
    const after = decodeCursor(query.cursor, requestedSortKeySchema);
    const keys = await listRequestedTicketKeys(this.prisma, principal.userId, {
      projectId: query.projectId ?? null,
      after:
        after === null
          ? null
          : { awaitingReply: after[0], updatedAt: new Date(after[1]), id: after[2] },
      limit: query.limit + 1,
    });
    const page = toPage(
      keys,
      query.limit,
      (key) => key.id,
      (key) => [key.awaitingReply, key.updatedAt.toISOString(), key.id],
    );
    const rows = await this.prisma.ticket.findMany({
      where: { AND: [accessibleBy(ability, 'read').ofType(TICKET), { id: { in: page.items } }] },
      select: ticketSelect(principal),
    });
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    return {
      items: page.items.flatMap((id) => {
        const row = rowsById.get(id);
        return row === undefined ? [] : [toTicketResponse(row, ability, principal)];
      }),
      nextCursor: page.nextCursor,
    };
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
      const before = await this.lockProjectAndFind(tx, ability, principal, target.id);
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
   * Changes the status of a ticket (§4.3) by the team: the rules of `status-transitions.ts` decide
   * the new status fields, the `duplicate_of` relation and the events; a request for the current
   * status changes nothing but a new reason or a new original (Q16).
   */
  async changeStatus(
    principal: UserPrincipal,
    target: VersionedTarget,
    input: ChangeTicketStatusDto,
  ): Promise<TicketResponse> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      let before = await this.lockProjectAndFind(tx, ability, principal, target.id);
      this.assertCan(ability, 'change_status', before);
      let original: ActivityEventTicketSnapshot | undefined;
      if (input.status === 'duplicate') {
        original = await this.lockOriginal(
          tx,
          ability,
          principal,
          before,
          input.duplicateOfTicketId,
        );
        // The ticket is locked now: the rules decide on a read after the lock, so a concurrent
        // change committed in between – e.g. one that left `duplicate` – is seen (§18.3).
        before = await this.findVisible(tx, ability, principal, target.id);
        this.assertCan(ability, 'change_status', before);
      }
      const change = changeStatus(
        { ...statusFieldsOf(before), source: before.source },
        {
          target: input.status,
          ...(input.status === 'rejected' ? { rejectionReason: input.rejectionReason } : {}),
          ...(original === undefined ? {} : { original }),
          currentOriginal: this.currentOriginal(before),
          confirmResolution: before.project.confirmResolution,
          now: this.clock.now(),
        },
      );
      await this.applyStatusChange(
        tx,
        { userId: principal.userId },
        before,
        target.version,
        change,
      );
      return toTicketResponse(
        await this.findVisible(tx, ability, principal, target.id),
        ability,
        principal,
      );
    });
  }

  /**
   * Changes the visibility of a ticket (§5.3, S1-11): for the requester, `all_customers` requests
   * sharing and `only_me` or `my_organization` withdraws a pending request; `visibility.ts`
   * decides the fields and the one event. The ticket row is locked, and the action is checked on
   * the locked row, so a withdrawal and a team decision never both apply. A request for the
   * current value changes nothing and needs the rights of editing the ticket (Q12).
   */
  async setVisibility(
    principal: UserPrincipal,
    target: VersionedTarget,
    input: SetTicketVisibilityDto,
  ): Promise<TicketResponse> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockAndFindTicket(tx, ability, principal, target.id);
      const isByRequester =
        principal.userKind === 'end_user' && before.requesterId === principal.userId;
      const change = changeVisibility(visibilityFieldsOf(before), {
        target: input.visibility,
        isByRequester,
        // Whether the requester may choose `my_organization` on this ticket now (Q4, Q19).
        canChooseOrganization:
          isByRequester &&
          ability.can(
            'set_visibility_my_organization',
            subject(TICKET, { ...before, visibility: 'only_me', sharingRequest: 'none' }),
          ),
      });
      if (change.fields === null) {
        this.assertCan(ability, 'update', before);
        assertVersionMatched({ count: before.version === target.version ? 1 : 0 });
        return toTicketResponse(before, ability, principal);
      }
      this.assertCan(ability, `set_visibility_${input.visibility}`, before);
      if (!isByRequester && input.visibility === 'my_organization') {
        await this.assertRequesterInOrganization(tx, before);
      }
      return this.applyVisibilityChange(tx, ability, principal, target, before, change);
    });
  }

  /**
   * Decides a pending sharing request (§5.2): one approval by any team member shares the ticket
   * with all customers, a refusal keeps the visibility and stores the reason (Q8). The first
   * decision wins: the second meets `409 ticket.sharing_not_pending` – from the target record
   * guard once the first is committed, from the check on the locked row otherwise.
   */
  async decideSharing(
    principal: UserPrincipal,
    target: VersionedTarget,
    decision: { approve: true } | ({ approve: false } & RejectTicketSharingDto),
  ): Promise<TicketResponse> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockAndFindTicket(tx, ability, principal, target.id);
      this.assertCan(ability, decision.approve ? 'approve_sharing' : 'reject_sharing', before);
      const fields = visibilityFieldsOf(before);
      const change = decision.approve
        ? approveSharing(fields)
        : rejectSharing(fields, decision.reason);
      return this.applyVisibilityChange(tx, ability, principal, target, before, change);
    });
  }

  /**
   * A ticket the principal can see, read again after locking its row (§18.3): the share lock of its
   * project first, then the row lock, so the rules decide on the state no concurrent change can
   * alter before the commit.
   */
  private async lockAndFindTicket(
    tx: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    ticketId: string,
  ): Promise<TicketRow> {
    await this.lockProjectAndFind(tx, ability, principal, ticketId);
    await lockTicketsForUpdate(tx, [ticketId]);
    return this.findVisible(tx, ability, principal, ticketId);
  }

  /**
   * `my_organization` set by the team (Q4, Q19): only while the requester still belongs to the
   * ticket's organization, which is active and has access to the project – otherwise the ticket
   * would be shown to people the author left and hidden from the author.
   */
  private async assertRequesterInOrganization(tx: Transaction, before: TicketRow): Promise<void> {
    const memberships = await tx.organizationMember.count({
      where: {
        userId: before.requesterId,
        organizationId: before.organizationId ?? undefined,
        organization: { state: 'active', projects: { some: { projectId: before.projectId } } },
      },
    });
    if (before.organizationId === null || memberships === 0) {
      throw new AppError('ticket.organization_changed');
    }
  }

  /**
   * Writes a change of the visibility fields with its version check, its activity event and – for
   * the team's changes and decisions – its audit log entry, in one transaction (§13.5).
   */
  private async applyVisibilityChange(
    tx: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    target: VersionedTarget,
    before: TicketRow,
    change: VisibilityChange,
  ): Promise<TicketResponse> {
    if (change.fields !== null) {
      assertVersionMatched(await tx.ticket.updateMany(versionedUpdate(target, change.fields)));
    }
    if (change.event !== null) {
      await this.activityEvents.record(tx, { userId: principal.userId }, target.id, [change.event]);
    }
    const ticketTarget = { type: TICKET, id: target.id };
    if (change.audit === 'ticket.visibility_changed' && change.fields !== null) {
      await this.auditLog.record(tx, {
        action: change.audit,
        actorId: principal.userId,
        target: ticketTarget,
        details: { from: before.visibility, to: change.fields.visibility },
      });
    } else if (change.audit !== null && change.audit !== 'ticket.visibility_changed') {
      await this.auditLog.record(tx, {
        action: change.audit,
        actorId: principal.userId,
        target: ticketTarget,
      });
    }
    return toTicketResponse(
      await this.findVisible(tx, ability, principal, target.id),
      ability,
      principal,
    );
  }

  /**
   * The requester's answer to the resolution confirmation (§4.3): "Yes, solved" closes the ticket,
   * "No, still a problem" moves it to `in_progress`. The first answer wins – of the requester, the
   * team or the timer: the update is conditional on the ticket still waiting for the confirmation,
   * so a lost race answers `409` like a ticket that no longer waits.
   */
  async confirmResolution(
    principal: UserPrincipal,
    ticketId: string,
    input: ConfirmResolutionDto,
  ): Promise<TicketResponse> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockProjectAndFind(tx, ability, principal, ticketId);
      this.assertCan(ability, 'confirm_resolution', before);
      const change = changeStatus(
        { ...statusFieldsOf(before), source: before.source },
        {
          target: answerTarget(input.answer),
          currentOriginal: null,
          confirmResolution: before.project.confirmResolution,
          now: this.clock.now(),
        },
      );
      if (!(await this.applyStatusChange(tx, { userId: principal.userId }, before, null, change))) {
        throw new AppError('ticket.resolution_confirmation_not_pending');
      }
      return toTicketResponse(
        await this.findVisible(tx, ability, principal, ticketId),
        ability,
        principal,
      );
    });
  }

  /**
   * The automatic close of a ticket whose requester did not answer within 7 days (§4.3), run by
   * the timer as the system. It changes nothing when the ticket no longer waits for the
   * confirmation or when it is gone. When its time has not come yet – a timer that fires early –
   * or the project is archived (Q19), it returns when to check again.
   */
  async closeUnconfirmedResolution(ticketId: string): Promise<AutomaticCloseOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const located = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: { projectId: true },
      });
      if (located === null || !(await this.projects.lockForShare(tx, located.projectId))) {
        return { outcome: 'skipped' };
      }
      const before = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: systemTicketSelect(),
      });
      if (before === null || !waitsForConfirmation(before) || before.waitingSince === null) {
        return { outcome: 'skipped' };
      }
      const dueAt = automaticCloseDueAt(before.waitingSince);
      if (dueAt > this.clock.now()) {
        return { outcome: 'not_due', checkAgainAt: dueAt };
      }
      if (before.project.state === 'archived') {
        return {
          outcome: 'archived',
          checkAgainAt: new Date(this.clock.now().getTime() + ARCHIVED_PROJECT_RECHECK_MS),
        };
      }
      const change = changeStatus(
        { ...statusFieldsOf(before), source: before.source },
        {
          target: 'done',
          currentOriginal: null,
          confirmResolution: before.project.confirmResolution,
          now: this.clock.now(),
        },
      );
      // A change of the team between the read and the update wins; the timer then does nothing.
      const isClosed = await this.applyStatusChange(
        tx,
        { automaticSource: 'system' },
        before,
        null,
        change,
      );
      return { outcome: isClosed ? 'closed' : 'skipped' };
    });
  }

  /**
   * When the automatic close of a ticket is due (§4.3): 7 × 24 hours after it started waiting for
   * the confirmation of its resolution; `null` when it does not wait for it (any more).
   */
  async automaticCloseDueAt(ticketId: string): Promise<Date | null> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { status: true, waitingReason: true, waitingSince: true },
    });
    return ticket === null || !waitsForConfirmation(ticket) || ticket.waitingSince === null
      ? null
      : automaticCloseDueAt(ticket.waitingSince);
  }

  /**
   * Writes a status change (§4.3) in the caller's transaction: the status fields with a new
   * version – conditional on `version` from `If-Match`, or on the status fields read under the
   * lock for an answer or the timer –, an ineligible assignee removed on a reopen (Q22), the
   * `duplicate_of` relation and the re-pointed duplicates of the ticket (Q8), the activity events
   * and the outbox event. A change that leaves the status fields as they are keeps the version,
   * after checking it. Returns `false`, writing nothing, when the state an answer or the timer read
   * has changed meanwhile.
   */
  private async applyStatusChange(
    tx: Transaction,
    actor: ActivityActor,
    before: StatusChangeSubject,
    version: number | null,
    change: StatusChange,
  ): Promise<boolean> {
    if (change.fields === null) {
      if (version !== null) {
        assertVersionMatched({ count: before.version === version ? 1 : 0 });
      }
    } else {
      const removedAssignee = change.reopen ? await this.ineligibleAssignee(tx, before) : null;
      const data = {
        ...change.fields,
        ...(removedAssignee === null ? {} : { assigneeId: null }),
      } satisfies Prisma.TicketUncheckedUpdateManyInput;
      const result =
        version === null
          ? // The first answer wins (§4.3): the condition is the state read under the lock.
            await tx.ticket.updateMany({
              where: {
                id: before.id,
                status: before.status,
                waitingReason: before.waitingReason,
                waitingSince: before.waitingSince,
              },
              data: { ...data, version: { increment: 1 } },
            })
          : await tx.ticket.updateMany(versionedUpdate({ id: before.id, version }, data));
      if (version === null && result.count === 0) {
        return false;
      }
      assertVersionMatched(result);
      if (removedAssignee !== null) {
        await this.activityEvents.record(tx, { automaticSource: 'system' }, before.id, [
          {
            type: 'assignee_changed',
            data: { from: removedAssignee, to: null },
            isPublic: false,
          },
        ]);
      }
    }
    await this.applyRelationChange(tx, before, change);
    await this.activityEvents.record(tx, actor, before.id, change.events);
    if (change.statusChanged !== null) {
      const { from, to, waitingReason } = change.statusChanged;
      await this.outbox.add(tx, {
        type: TICKET_STATUS_CHANGED,
        payload: {
          ticketId: before.id,
          projectId: before.projectId,
          from,
          to,
          fromPublic: publicStatusOf(from),
          toPublic: publicStatusOf(to),
          waitingReason,
          reopen: change.statusChanged.reopen,
          actorId: 'userId' in actor ? actor.userId : null,
        } satisfies TicketStatusChangedPayload,
      });
    }
    return true;
  }

  /**
   * The `duplicate_of` relation of a change (§3.5): set or replaced, or removed on leaving
   * `duplicate`. A ticket that becomes a duplicate passes its own duplicates on to its original,
   * each with an automatic event (Q8), so no chain arises.
   */
  private async applyRelationChange(
    tx: Transaction,
    before: StatusChangeSubject,
    change: StatusChange,
  ): Promise<void> {
    const { relation } = change;
    if (relation.kind === 'remove') {
      await tx.ticketRelation.deleteMany({
        where: { kind: 'duplicate_of', sourceTicketId: before.id },
      });
      return;
    }
    if (relation.kind === 'keep') {
      return;
    }
    await tx.ticketRelation.deleteMany({
      where: { kind: 'duplicate_of', sourceTicketId: before.id },
    });
    await tx.ticketRelation.create({
      data: {
        kind: 'duplicate_of',
        sourceTicketId: before.id,
        targetTicketId: relation.original.id,
      },
      select: { id: true },
    });
    const duplicates = await tx.ticketRelation.findMany({
      where: { kind: 'duplicate_of', targetTicketId: before.id },
      select: { id: true, sourceTicketId: true },
      orderBy: { sourceTicketId: 'asc' },
    });
    if (duplicates.length === 0) {
      return;
    }
    const self = await tx.ticket.findUniqueOrThrow({
      where: { id: before.id },
      select: { id: true, number: true, project: { select: { key: true } } },
    });
    await tx.ticketRelation.updateMany({
      where: { id: { in: duplicates.map((duplicate) => duplicate.id) } },
      data: { targetTicketId: relation.original.id },
    });
    for (const duplicate of duplicates) {
      await this.activityEvents.record(
        tx,
        { automaticSource: 'system' },
        duplicate.sourceTicketId,
        [
          {
            type: 'duplicate_original_changed',
            data: {
              from: { id: self.id, number: self.number, projectKey: self.project.key },
              to: relation.original,
            },
            isPublic: false,
          },
        ],
      );
    }
  }

  /**
   * The original a ticket becomes a duplicate of (§3.5): visible to the principal (`404`), in the
   * same project (`422 ticket.duplicate_other_project`), flattened to the original of a
   * duplicate, never the ticket itself (`422 ticket.duplicate_of_self`). The ticket, the requested
   * original and the duplicates of the ticket are locked for an update in ID order, the original
   * of a duplicate after them, and every decision is taken on a read after the lock – so two
   * concurrent changes can create neither a chain nor a cycle.
   */
  private async lockOriginal(
    tx: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    ticket: TicketRow,
    originalId: string,
  ): Promise<ActivityEventTicketSnapshot> {
    // Visibility and project first, so a ticket of another project is never locked; the project
    // of a ticket never changes.
    const requested = await this.findVisible(tx, ability, principal, originalId);
    if (requested.projectId !== ticket.projectId) {
      throw new AppError('ticket.duplicate_other_project', [
        { pointer: '/duplicateOfTicketId', code: 'field.invalid' },
      ]);
    }
    const duplicates = await tx.ticketRelation.findMany({
      where: { kind: 'duplicate_of', targetTicketId: ticket.id },
      select: { sourceTicketId: true },
    });
    await lockTicketsForUpdate(tx, [
      ticket.id,
      originalId,
      ...duplicates.map((duplicate) => duplicate.sourceTicketId),
    ]);
    let original = await this.findVisible(tx, ability, principal, originalId);
    // No chains exist, so one step reaches the original; a concurrent change of that original
    // is seen once it is locked.
    for (let step = 0; original.status === 'duplicate'; step += 1) {
      const next = originalOf(original);
      if (next === null || step > 1) {
        throw new Error(`The duplicate ${original.id} has no original`);
      }
      await lockTicketsForUpdate(tx, [next.id]);
      original = await this.findVisible(tx, ability, principal, next.id);
    }
    if (original.id === ticket.id) {
      throw new AppError('ticket.duplicate_of_self', [
        { pointer: '/duplicateOfTicketId', code: 'field.invalid' },
      ]);
    }
    return { id: original.id, number: original.number, projectKey: original.project.key };
  }

  /** The current original of a duplicate, as events store it. */
  private currentOriginal(row: TicketRow): ActivityEventTicketSnapshot | null {
    const original = originalOf(row);
    return original === null ? null : snapshotOf(original);
  }

  /**
   * The assignee of a reopened ticket who may no longer be assigned (§3.2, Q22), decided after the
   * share locks of the membership and the account as an assignment takes them, so a concurrent
   * removal or deactivation waits for the reopen and its unassignment then finds the ticket open.
   */
  private async ineligibleAssignee(
    tx: Transaction,
    ticket: StatusChangeSubject,
  ): Promise<{ id: string; displayName: string | null } | null> {
    if (ticket.assignee === null) {
      return null;
    }
    return (await this.isEligibleAssignee(tx, ticket.projectId, ticket.assignee.id))
      ? null
      : ticket.assignee;
  }

  /**
   * The activity events of a ticket the target record guard let the principal read, oldest first:
   * end users see only the public ones (§4.5), in their shape (Q11) – public status codes, and the
   * original of a duplicate only when they may read it, checked for the whole page in one query.
   */
  async listActivityEvents(
    principal: UserPrincipal,
    ticketId: string,
    query: ListActivityEventsQuery,
  ): Promise<ActivityEventPage> {
    const isEndUser = principal.userKind === 'end_user';
    const page = await this.activityEvents.list(ticketId, query, { publicOnly: isEndUser });
    if (!isEndUser) {
      return page;
    }
    const originalIds = originalIdsOf(page.items);
    const readableOriginals =
      originalIds.length === 0
        ? []
        : await this.prisma.ticket.findMany({
            where: {
              AND: [
                accessibleBy(this.abilities.forPrincipal(principal), 'read').ofType(TICKET),
                { id: { in: originalIds } },
              ],
            },
            select: { id: true },
          });
    const readableIds = new Set(readableOriginals.map(({ id }) => id));
    // The actors the identity rule hides from this reader (§5.4, Q9).
    const actorIds = [...new Set(page.items.flatMap((event) => event.actor?.id ?? []))];
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: identitySelect(principal),
    });
    const hiddenActorIds = new Set(
      actors.filter((actor) => visiblePerson(principal, actor) === null).map(({ id }) => id),
    );
    return {
      items: page.items.map((event) => {
        const endUserEvent = toEndUserEvent(event, readableIds);
        return event.actor !== null && hiddenActorIds.has(event.actor.id)
          ? { ...endUserEvent, actor: null }
          : endUserEvent;
      }),
      nextCursor: page.nextCursor,
    };
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
    if (!(await this.isEligibleAssignee(tx, projectId, userId))) {
      throw assigneeNotEligible();
    }
  }

  /** Whether an account may be assigned in a project, after the share locks of the assignment. */
  private async isEligibleAssignee(
    tx: Transaction,
    projectId: string,
    userId: string,
  ): Promise<boolean> {
    if (!(await this.projects.lockMemberForShare(tx, projectId, userId))) {
      return false;
    }
    if (!(await this.users.lockForShare(tx, userId))) {
      return false;
    }
    const eligible = await tx.projectMember.count({
      where: { projectId, userId, ...ASSIGNABLE_MEMBER },
    });
    return eligible > 0;
  }

  /**
   * A ticket the principal can see, read after the share lock of its project (§18.3, Q23): a
   * concurrent archive, key change or deletion of the project waits for the change, or the change
   * waits for it and reads the archived state. The project of a ticket never changes, so it is
   * read before the lock; `404` when the ticket does not exist or is invisible.
   */
  private async lockProjectAndFind(
    tx: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    ticketId: string,
  ): Promise<TicketRow> {
    const located = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: { projectId: true },
    });
    if (located === null || !(await this.projects.lockForShare(tx, located.projectId))) {
      throw new AppError('request.not_found');
    }
    return this.findVisible(tx, ability, principal, ticketId);
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
