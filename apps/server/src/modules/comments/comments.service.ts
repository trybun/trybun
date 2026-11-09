import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { Injectable } from '@nestjs/common';
import {
  type CommentAction,
  type CommentKind,
  type CommentPage,
  type CommentResponse,
  type CreateCommentDto,
  type ListCommentsQuery,
  type MentionCandidatePage,
  type MentionCandidatesDto,
  type RedactCommentDto,
  type UpdateCommentDto,
  type ListTimelineQuery,
  type TimelineItem,
  type TimelinePage,
  HIDDEN_MENTION_ID,
  MAX_MENTION_CANDIDATES,
  MAX_MENTIONS_PER_TEXT,
} from '@trybun/contracts/comments';
import type {
  ContentRevisionPage,
  ListContentRevisionsQuery,
} from '@trybun/contracts/content-revisions';
import { mentionIdsOf } from '@trybun/markdown';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory, type AppAbility } from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import { Clock } from '../../platform/clock/clock.js';
import { decodeCursor, encodeCursor } from '../../platform/database/cursor.js';
import {
  assertVersionMatched,
  type VersionedTarget,
  versionedUpdate,
  versionedWhere,
} from '../../platform/database/optimistic-locking.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { AppError } from '../../platform/errors/app-error.js';
import {
  ActivityEventsService,
  eventSortKeySchema,
} from '../activity-events/activity-events.service.js';
import { AttachmentLinksService } from '../attachments/attachment-links.service.js';
import { AuditLogEntriesService } from '../audit-log-entries/audit-log-entries.service.js';
import { ContentRevisionsService } from '../content-revisions/content-revisions.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TICKET, ticketRuleSelect } from '../tickets/tickets.abilities.js';
import {
  type CommentRow,
  commentSelect,
  revisionsForReader,
  toCommentResponse,
} from './comment-responses.js';
import { COMMENT } from './comments.abilities.js';
import { lockCommentForUpdate } from './comments.sql.js';
import { type MentionedTicket, mentionScope } from './mention-scope.js';
import { identitySelect, visiblePerson } from '../users/visible-person.js';

/** The fields of a locked ticket a new comment reads: its audience (§5.2) and mention scope. */
export type CommentedTicket = MentionedTicket;

/** The fields of a ticket the mention scope reads. */
const MENTIONED_TICKET_SELECT = {
  id: true,
  projectId: true,
  requesterId: true,
  organizationId: true,
  assigneeId: true,
  visibility: true,
} satisfies Prisma.TicketSelect;

/** Comments, like events, are sorted by their time-ordered ID (UUIDv7, S1-12 Q11). */
const commentSortKeySchema = eventSortKeySchema;

/**
 * Comments and internal notes of tickets (§6.1, S1-12): reading them, their merged timeline with
 * the activity events, and – for the tickets module, which locks the ticket – writing them. It
 * never writes the ticket itself (tickets → comments, Q11).
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
    private readonly activityEvents: ActivityEventsService,
    private readonly attachmentLinks: AttachmentLinksService,
    private readonly revisions: ContentRevisionsService,
    private readonly projects: ProjectsService,
    private readonly auditLog: AuditLogEntriesService,
    private readonly clock: Clock,
  ) {}

  /**
   * Deletes a comment or a note (§6.1, S1-12 Q7): the author their own, the team any. The row, its
   * revisions, its mentions and its attachments are deleted physically (§17.2); the team timeline
   * keeps the internal event `comment_deleted` with the person who deleted it, its data only the ID
   * and the kind. A deletion by a team member is written to the audit log (§13.5).
   */
  async delete(principal: UserPrincipal, target: VersionedTarget): Promise<void> {
    const ability = this.abilities.forPrincipal(principal);
    await this.prisma.$transaction(async (tx) => {
      const before = await this.lockAndFind(tx, ability, principal, target.id);
      assertCan(ability, 'delete', before);
      assertVersionMatched({ count: before.version === target.version ? 1 : 0 });
      await this.attachmentLinks.deleteOfComment(tx, before.id);
      assertVersionMatched(await tx.comment.deleteMany({ where: versionedWhere(target) }));
      await this.activityEvents.record(tx, { userId: principal.userId }, before.ticketId, [
        {
          type: 'comment_deleted',
          data: { commentId: before.id, kind: before.kind },
          isPublic: false,
        },
      ]);
      if (principal.userKind === 'team') {
        await this.auditLog.record(tx, {
          action: 'comment.deleted',
          actorId: principal.userId,
          target: { type: COMMENT, id: before.id },
          details: { ticketId: before.ticketId, kind: before.kind },
        });
      }
    });
  }

  /**
   * Edits the own comment or note (§6.1, S1-12 Q12): the replaced text becomes a content revision
   * with its author and the time it was written, the comment gets the edit marker, and the team
   * timeline the internal event `comment_edited` without content (Q6). The kind and the audience
   * never change; further own drafts may be linked. The project is locked in share mode, so an
   * archiving waits for the edit or refuses it (§7.3).
   */
  async update(
    principal: UserPrincipal,
    target: VersionedTarget,
    input: UpdateCommentDto,
  ): Promise<CommentResponse> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockAndFind(tx, ability, principal, target.id);
      assertCan(ability, 'update', before);
      const body = restoreHiddenMentions(principal, input.body, before);
      if (body !== before.body) {
        const now = this.clock.now();
        assertVersionMatched(
          await tx.comment.updateMany(
            versionedUpdate(target, {
              body,
              editedAt: now,
              editedById: principal.userId,
            }),
          ),
        );
        await this.revisions.record(tx, { commentId: before.id }, replacedVersionOf(before));
        await this.activityEvents.record(tx, { userId: principal.userId }, before.ticketId, [
          { type: 'comment_edited', data: { commentId: before.id }, isPublic: false },
        ]);
        const ticket = await tx.ticket.findUniqueOrThrow({
          where: { id: before.ticketId },
          select: MENTIONED_TICKET_SELECT,
        });
        await this.syncMentions(
          tx,
          principal,
          ability,
          ticket,
          before.kind,
          before.id,
          body,
          before.mentions.map(({ user }) => user.id),
        );
      } else {
        assertVersionMatched({ count: before.version === target.version ? 1 : 0 });
      }
      await this.attachmentLinks.linkDrafts(
        tx,
        principal,
        { commentId: before.id },
        input.attachmentIds ?? [],
      );
      return this.read(tx, principal, ability, before.id);
    });
  }

  /**
   * Redacts a comment or a note (§6.1, §13.2, S1-12 Q9): the new text replaces the current one,
   * which is never kept, and the listed revisions are deleted, so after the default selection no
   * row holds the earlier text. It marks the comment edited, writes the internal event
   * `comment_redacted` and the audit entry `comment.redacted`, none with content; the mentions are
   * read again from the new text. A stale version gets `412`, so nobody redacts a text they have
   * not seen.
   */
  async redact(
    principal: UserPrincipal,
    target: VersionedTarget,
    input: RedactCommentDto,
  ): Promise<CommentResponse> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockAndFind(tx, ability, principal, target.id);
      assertCan(ability, 'redact', before);
      assertVersionMatched(
        await tx.comment.updateMany(
          versionedUpdate(target, {
            body: input.body,
            editedAt: this.clock.now(),
            editedById: principal.userId,
          }),
        ),
      );
      await this.revisions.purge(tx, { commentId: before.id }, input.purgeRevisionIds);
      const ticket = await tx.ticket.findUniqueOrThrow({
        where: { id: before.ticketId },
        select: MENTIONED_TICKET_SELECT,
      });
      await this.syncMentions(
        tx,
        principal,
        ability,
        ticket,
        before.kind,
        before.id,
        input.body,
        before.mentions.map(({ user }) => user.id),
      );
      await this.activityEvents.record(tx, { userId: principal.userId }, before.ticketId, [
        { type: 'comment_redacted', data: { commentId: before.id }, isPublic: false },
      ]);
      await this.auditLog.record(tx, {
        action: 'comment.redacted',
        actorId: principal.userId,
        target: { type: COMMENT, id: before.id },
        details: { ticketId: before.ticketId },
      });
      return this.read(tx, principal, ability, before.id);
    });
  }

  /**
   * The earlier versions of a comment, newest first (§6.1, S1-12 Q3): the target record guard has
   * checked `read_revisions` – the team, and the author of the comment.
   */
  async listRevisions(
    principal: UserPrincipal,
    commentId: string,
    query: ListContentRevisionsQuery,
  ): Promise<ContentRevisionPage> {
    return revisionsForReader(
      this.prisma,
      principal,
      await this.revisions.list(this.prisma, principal, { commentId }, query),
    );
  }

  /**
   * A comment the principal reads, read again after the share lock of its ticket's project and
   * the row lock of the comment (§18.3): `404` when it is missing or invisible.
   */
  private async lockAndFind(
    tx: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    commentId: string,
  ): Promise<CommentRow> {
    const located = await tx.comment.findUnique({
      where: { id: commentId },
      select: { ticket: { select: { projectId: true } } },
    });
    if (
      located === null ||
      !(await this.projects.lockForShare(tx, located.ticket.projectId)) ||
      !(await lockCommentForUpdate(tx, commentId))
    ) {
      throw new AppError('request.not_found');
    }
    const row = await tx.comment.findFirst({
      where: { AND: [accessibleBy(ability, 'read').ofType(COMMENT), { id: commentId }] },
      select: commentSelect(principal),
    });
    if (row === null) {
      throw new AppError('request.not_found');
    }
    return row;
  }

  /**
   * The comments of a ticket the principal reads, oldest first (§6.1). The caller has checked
   * that the principal reads the ticket; the comment rules decide each comment (§5.2).
   */
  async list(
    principal: UserPrincipal,
    ticketId: string,
    query: ListCommentsQuery,
  ): Promise<CommentPage> {
    const ability = this.abilities.forPrincipal(principal);
    const after = decodeCursor(query.cursor, commentSortKeySchema);
    const rows = await this.commentsAfter(this.prisma, principal, ability, ticketId, {
      afterId: after?.[0] ?? null,
      take: query.limit + 1,
    });
    const items = await this.toResponses(this.prisma, principal, ability, rows);
    const page = items.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page,
      nextCursor: items.length > query.limit && last !== undefined ? encodeCursor([last.id]) : null,
    };
  }

  /** A comment the principal reads (§6.1); the target record guard has checked it. */
  async get(principal: UserPrincipal, commentId: string): Promise<CommentResponse> {
    const ability = this.abilities.forPrincipal(principal);
    return this.read(this.prisma, principal, ability, commentId);
  }

  /**
   * The timeline of a ticket, oldest first (S1-12 Q11): its comments and its activity events in
   * one list, merged by their time-ordered IDs, the last ID as the cursor. Each page takes the
   * next `limit` items of both lists. With **Hide events** on (§4.5, S1-10), the account sees
   * only the comments.
   */
  async timeline(
    principal: UserPrincipal,
    ticketId: string,
    query: ListTimelineQuery,
  ): Promise<TimelinePage> {
    const ability = this.abilities.forPrincipal(principal);
    const afterId = decodeCursor(query.cursor, commentSortKeySchema)?.[0] ?? null;
    const take = query.limit + 1;
    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { hideTimelineEvents: true },
    });
    const [rows, events] = await Promise.all([
      this.commentsAfter(this.prisma, principal, ability, ticketId, { afterId, take }),
      account.hideTimelineEvents
        ? Promise.resolve([])
        : this.activityEvents.eventsForViewer(
            principal,
            ticketId,
            { afterId, take },
            accessibleBy(ability, 'read').ofType(TICKET),
          ),
    ]);
    const comments = await this.toResponses(this.prisma, principal, ability, rows);
    const merged: TimelineItem[] = [
      ...comments.map((comment) => ({ type: 'comment' as const, comment })),
      ...events.map((event) => ({ type: 'event' as const, event })),
      // The database's order of UUIDs: their lower-case hex strings compared character by character.
    ].sort((a, b) => (idOf(a) < idOf(b) ? -1 : idOf(a) > idOf(b) ? 1 : 0));
    const page = merged.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page,
      nextCursor:
        merged.length > query.limit && last !== undefined ? encodeCursor([idOf(last)]) : null,
    };
  }

  /**
   * Writes a comment of a ticket in the caller's transaction (§6.1, S1-12): the tickets module has
   * locked the ticket and checked `add_comment` and, for a note, `add_internal_note`. A public
   * comment takes its audience from the ticket's effective visibility now – with the ticket's
   * organization for `my_organization` (§5.2) – and keeps it; an internal note has none. The
   * principal's own drafts are linked to it. A comment never changes the ticket (§17.2).
   */
  async add(
    tx: Transaction,
    principal: UserPrincipal,
    ability: AppAbility,
    ticket: CommentedTicket,
    input: CreateCommentDto,
    /** Where a refused mention points: the text's field of the request (§17.2). */
    bodyPointer = '/body',
  ): Promise<CommentResponse> {
    const isPublic = input.kind === 'public';
    const { id } = await tx.comment.create({
      data: {
        ticketId: ticket.id,
        authorId: principal.userId,
        kind: input.kind,
        audience: isPublic ? ticket.visibility : null,
        audienceOrganizationId:
          isPublic && ticket.visibility === 'my_organization' ? ticket.organizationId : null,
        body: input.body,
      },
      select: { id: true },
    });
    await this.syncMentions(
      tx,
      principal,
      ability,
      ticket,
      input.kind,
      id,
      input.body,
      [],
      bodyPointer,
    );
    await this.attachmentLinks.linkDrafts(
      tx,
      principal,
      { commentId: id },
      input.attachmentIds ?? [],
    );
    return this.read(tx, principal, ability, id);
  }

  /**
   * The people a comment being written may mention whose display name contains the query
   * (§7.3, S1-12 Q4): at most 10, team members first. The target record guard has checked
   * `add_comment`; a note also needs `add_internal_note`.
   */
  async mentionCandidates(
    principal: UserPrincipal,
    ticketId: string,
    input: MentionCandidatesDto,
  ): Promise<MentionCandidatePage> {
    const ability = this.abilities.forPrincipal(principal);
    const ticket = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { ...MENTIONED_TICKET_SELECT, ...ticketRuleSelect(principal) },
    });
    if (input.kind === 'internal') {
      const record = subject(TICKET, ticket);
      if (!ability.can('add_internal_note', record)) {
        throw new AppError(
          reasonCode(ability.relevantRuleFor('add_internal_note', record)?.reason),
        );
      }
    }
    const scope = mentionScope(
      principal,
      ability,
      ticket,
      input.kind,
      await this.organizationOf(this.prisma, principal),
    );
    const people = await this.prisma.user.findMany({
      where: {
        AND: [
          scope,
          input.query === '' ? {} : { displayName: { contains: input.query, mode: 'insensitive' } },
        ],
      },
      select: identitySelect(principal),
      orderBy: [{ kind: 'asc' }, { displayName: 'asc' }, { id: 'asc' }],
      take: MAX_MENTION_CANDIDATES,
    });
    return {
      items: people.flatMap((person) =>
        visiblePerson(principal, person) === null
          ? []
          : [{ id: person.id, displayName: person.displayName, userKind: person.kind }],
      ),
      nextCursor: null,
    };
  }

  /**
   * Stores the mentions of a text (§6.1, S1-12 Q4): at most 50 people (`422
   * comment.too_many_mentions`); a mention that is new in the text must be in the mention scope,
   * else `422 comment.mention_not_allowed` – the same code for an unknown ID, so nothing is
   * revealed; existing ones are kept, removed ones deleted. A mention never grants access.
   */
  private async syncMentions(
    tx: Transaction,
    principal: UserPrincipal,
    ability: AppAbility,
    ticket: MentionedTicket,
    kind: CommentKind,
    commentId: string,
    body: string,
    existingIds: readonly string[],
    bodyPointer = '/body',
  ): Promise<void> {
    const ids = mentionIdsOf(body);
    if (ids.length > MAX_MENTIONS_PER_TEXT) {
      throw new AppError('comment.too_many_mentions', [
        { pointer: bodyPointer, code: 'field.invalid' },
      ]);
    }
    const existing = new Set(existingIds);
    const added = ids.filter((id) => !existing.has(id));
    if (added.length > 0) {
      const scope = mentionScope(
        principal,
        ability,
        ticket,
        kind,
        await this.organizationOf(tx, principal),
      );
      const allowed = await tx.user.count({ where: { AND: [scope, { id: { in: added } }] } });
      if (allowed !== added.length) {
        throw new AppError('comment.mention_not_allowed', [
          { pointer: bodyPointer, code: 'field.invalid' },
        ]);
      }
    }
    await tx.commentMention.deleteMany({ where: { commentId, userId: { notIn: ids } } });
    if (added.length > 0) {
      await tx.commentMention.createMany({
        data: added.map((userId) => ({ commentId, userId })),
        skipDuplicates: true,
      });
    }
  }

  /** The organization the principal belongs to now, if any (§7.3). */
  private async organizationOf(db: Transaction, principal: UserPrincipal): Promise<string | null> {
    if (principal.userKind !== 'end_user') {
      return null;
    }
    const membership = await db.organizationMember.findUnique({
      where: { userId: principal.userId },
      select: { organizationId: true },
    });
    return membership?.organizationId ?? null;
  }

  /** A comment through the ability (§18.3): `404` when the principal cannot read it. */
  async read(
    db: Transaction,
    principal: UserPrincipal,
    ability: AppAbility,
    commentId: string,
  ): Promise<CommentResponse> {
    const row = await db.comment.findFirst({
      where: { AND: [accessibleBy(ability, 'read').ofType(COMMENT), { id: commentId }] },
      select: commentSelect(principal),
    });
    if (row === null) {
      throw new AppError('request.not_found');
    }
    const [response] = await this.toResponses(db, principal, ability, [row]);
    if (response === undefined) {
      throw new AppError('request.not_found');
    }
    return response;
  }

  /** At most `take` comments of a ticket the principal reads after the comment `afterId`. */
  private commentsAfter(
    db: Transaction,
    principal: UserPrincipal,
    ability: AppAbility,
    ticketId: string,
    { afterId, take }: { afterId: string | null; take: number },
  ): Promise<CommentRow[]> {
    return db.comment.findMany({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType(COMMENT),
          { ticketId },
          afterId === null ? {} : { id: { gt: afterId } },
        ],
      },
      select: commentSelect(principal),
      orderBy: { id: 'asc' },
      take,
    });
  }

  /** The responses of comments with their attachments, loaded once for the page. */
  private async toResponses(
    db: Transaction,
    principal: UserPrincipal,
    ability: AppAbility,
    rows: readonly CommentRow[],
  ): Promise<CommentResponse[]> {
    const attachments = await this.attachmentLinks.ofComments(
      db,
      principal,
      ability,
      rows.map(({ id }) => id),
    );
    return rows.map((row) =>
      toCommentResponse(row, ability, principal, attachments.get(row.id) ?? []),
    );
  }
}

/**
 * The version an edit or a redaction replaces (§6.1): its text, the person who wrote it – the
 * last editor, else the author – and when.
 */
function replacedVersionOf(row: CommentRow) {
  return {
    body: row.body,
    authorId: row.editedById ?? row.authorId,
    writtenAt: row.editedAt ?? row.createdAt,
  };
}

/**
 * The submitted text of an edit with the hidden mentions restored (§5.4, S1-12): the editor saw a
 * person hidden from them as `@{customer}`, so each such token is replaced, in order, by the
 * hidden people of the previous text. A token more than there were is refused, as a mention of
 * someone outside the scope.
 */
function restoreHiddenMentions(principal: UserPrincipal, body: string, before: CommentRow): string {
  const token = `@{${HIDDEN_MENTION_ID}}`;
  if (!body.includes(token)) {
    return body;
  }
  const people = new Map(before.mentions.map(({ user }) => [user.id, user]));
  // Every occurrence, in order, as the reader's text masked them (`mentionsForReader`).
  const hidden = [...before.body.matchAll(/@\{([0-9a-f-]{36})\}/g)].flatMap(([, id]) => {
    const person = id === undefined ? undefined : people.get(id);
    return person !== undefined && visiblePerson(principal, person) === null ? [person.id] : [];
  });
  let index = 0;
  const restored = body.replaceAll(token, () => {
    const id = hidden[index];
    index += 1;
    return id === undefined ? token : `@{${id}}`;
  });
  if (index > hidden.length) {
    throw new AppError('comment.mention_not_allowed', [
      { pointer: '/body', code: 'field.invalid' },
    ]);
  }
  return restored;
}

/** `403`, or the code of the denying rule, when the principal may not act on the comment. */
function assertCan(ability: AppAbility, action: CommentAction, row: CommentRow): void {
  const record = subject(COMMENT, row);
  if (!ability.can(action, record)) {
    throw new AppError(reasonCode(ability.relevantRuleFor(action, record)?.reason));
  }
}

/** The time-ordered ID of a timeline item. */
function idOf(item: TimelineItem): string {
  return item.type === 'comment' ? item.comment.id : item.event.id;
}
