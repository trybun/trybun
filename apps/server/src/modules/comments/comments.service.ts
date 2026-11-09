import { accessibleBy } from '@casl/prisma/runtime';
import { Injectable } from '@nestjs/common';
import type {
  CommentPage,
  CommentResponse,
  CreateCommentDto,
  ListCommentsQuery,
  ListTimelineQuery,
  TimelineItem,
  TimelinePage,
} from '@trybun/contracts/comments';
import type { TicketVisibility } from '@trybun/contracts/tickets';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory, type AppAbility } from '../../platform/authorization/ability-factory.js';
import { decodeCursor, encodeCursor } from '../../platform/database/cursor.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { AppError } from '../../platform/errors/app-error.js';
import {
  ActivityEventsService,
  eventSortKeySchema,
} from '../activity-events/activity-events.service.js';
import { AttachmentLinksService } from '../attachments/attachment-links.service.js';
import { TICKET } from '../tickets/tickets.abilities.js';
import { type CommentRow, commentSelect, toCommentResponse } from './comment-responses.js';
import { COMMENT } from './comments.abilities.js';

/** The fields of a locked ticket a new comment reads (§5.2). */
export interface CommentedTicket {
  id: string;
  visibility: TicketVisibility;
  organizationId: string | null;
}

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
  ) {}

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
    ].sort((a, b) => idOf(a).localeCompare(idOf(b)));
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
    await this.attachmentLinks.linkDrafts(
      tx,
      principal,
      { commentId: id },
      input.attachmentIds ?? [],
    );
    return this.read(tx, principal, ability, id);
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

/** The time-ordered ID of a timeline item. */
function idOf(item: TimelineItem): string {
  return item.type === 'comment' ? item.comment.id : item.event.id;
}
