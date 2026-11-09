import { Injectable } from '@nestjs/common';
import type {
  ActivityEvent,
  ActivityEventData,
  ActivityEventPage,
  ActivityEventResponse,
  ActivityEventSource,
  ActivityEventType,
  ListActivityEventsQuery,
} from '@trybun/contracts/activity-events';
import {
  activityEventDataSchema,
  activityEventTypeSchema,
} from '@trybun/contracts/activity-events';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { decodeCursor, encodeCursor } from '../../platform/database/cursor.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { identitySelect, visiblePerson } from '../users/visible-person.js';
import { originalIdsOf, toEndUserEvent } from './domain/end-user-events.js';
import { fieldChanges, type TrackedTicketFields } from './domain/field-changes.js';

/** Who made a change: a person, or the system for an automatic change (§4.5). */
export type ActivityActor = { userId: string } | { automaticSource: ActivityEventSource };

const EVENT_SELECT = {
  id: true,
  type: true,
  data: true,
  automaticSource: true,
  createdAt: true,
  actor: { select: { id: true, displayName: true } },
} satisfies Prisma.ActivityEventSelect;

type EventRow = Prisma.ActivityEventGetPayload<{ select: typeof EVENT_SELECT }>;

/**
 * The response shape of an event (§18.3): the actor's name as it is now, the snapshots of `data`
 * as they were at the time of the change.
 */
function toEventResponse(row: EventRow): ActivityEvent {
  return {
    id: row.id,
    type: activityEventTypeSchema.parse(row.type),
    data: row.data === null ? null : activityEventDataSchema.parse(row.data),
    actor: row.actor,
    automaticSource: row.automaticSource,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Events are sorted by their time-ordered ID (UUIDv7). */
export const eventSortKeySchema = z.tuple([z.uuid()]);

/**
 * The activity history of tickets (§4.5): immutable events, written in the transaction of the
 * change they record. Other modules write their events through this service; it never reads or
 * writes their records.
 */
@Injectable()
export class ActivityEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records the changes of a ticket from the record before and after the change (§18.3): one
   * internal event per changed field, written with the change in its transaction.
   */
  async recordChanges(
    tx: Transaction,
    actor: ActivityActor,
    ticketId: string,
    before: TrackedTicketFields,
    after: TrackedTicketFields,
  ): Promise<void> {
    const changes = fieldChanges(before, after);
    if (changes.length === 0) {
      return;
    }
    await tx.activityEvent.createMany({
      data: changes.map((change) => ({
        ticketId,
        type: change.type,
        data: change.data ?? undefined,
        actorId: 'userId' in actor ? actor.userId : null,
        automaticSource: 'automaticSource' in actor ? actor.automaticSource : null,
        isPublic: false,
      })),
    });
  }

  /**
   * Records events a rule of the producing module has decided (§18.3), e.g. a status change, in
   * the transaction of the change; each event says itself whether it is public (§4.5).
   */
  async record(
    tx: Transaction,
    actor: ActivityActor,
    ticketId: string,
    events: readonly {
      type: ActivityEventType;
      data: ActivityEventData | null;
      isPublic: boolean;
    }[],
  ): Promise<void> {
    if (events.length === 0) {
      return;
    }
    await tx.activityEvent.createMany({
      data: events.map((event) => ({
        ticketId,
        type: event.type,
        data: event.data ?? undefined,
        actorId: 'userId' in actor ? actor.userId : null,
        automaticSource: 'automaticSource' in actor ? actor.automaticSource : null,
        isPublic: event.isPublic,
      })),
    });
  }

  /**
   * The events of a ticket for a reader, oldest first (§4.5), in pages of the shared envelope. The
   * caller has checked that the principal may read the ticket and passes the filter of the tickets
   * they read (`accessibleBy`), which decides the originals of duplicates an end user sees.
   */
  async listForViewer(
    principal: UserPrincipal,
    ticketId: string,
    query: ListActivityEventsQuery,
    readableTickets: Prisma.TicketWhereInput,
  ): Promise<ActivityEventPage> {
    const after = decodeCursor(query.cursor, eventSortKeySchema);
    const items = await this.eventsForViewer(
      principal,
      ticketId,
      { afterId: after?.[0] ?? null, take: query.limit + 1 },
      readableTickets,
    );
    const page = items.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page,
      nextCursor: items.length > query.limit && last !== undefined ? encodeCursor([last.id]) : null,
    };
  }

  /**
   * At most `take` events of a ticket after the event `afterId`, oldest first, in the shape of
   * their reader (§4.5, S1-11 Q9): the team gets every event, an end user only public events with
   * their public data, the originals of duplicates they may read, and no actor the identity rule
   * hides (§5.4). The timeline of comments merges them (S1-12 Q11).
   */
  async eventsForViewer(
    principal: UserPrincipal,
    ticketId: string,
    { afterId, take }: { afterId: string | null; take: number },
    readableTickets: Prisma.TicketWhereInput,
  ): Promise<ActivityEventResponse[]> {
    const isEndUser = principal.userKind === 'end_user';
    const rows = await this.prisma.activityEvent.findMany({
      where: {
        ticketId,
        ...(isEndUser ? { isPublic: true } : {}),
        ...(afterId === null ? {} : { id: { gt: afterId } }),
      },
      select: EVENT_SELECT,
      orderBy: { id: 'asc' },
      take,
    });
    const events = rows.map(toEventResponse);
    if (!isEndUser) {
      return events;
    }
    const originalIds = originalIdsOf(events);
    const readableOriginals =
      originalIds.length === 0
        ? []
        : await this.prisma.ticket.findMany({
            where: { AND: [readableTickets, { id: { in: originalIds } }] },
            select: { id: true },
          });
    const readableIds = new Set(readableOriginals.map(({ id }) => id));
    // The actors the identity rule hides from this reader (§5.4, Q9).
    const actorIds = [...new Set(events.flatMap((event) => event.actor?.id ?? []))];
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: identitySelect(principal),
    });
    const hiddenActorIds = new Set(
      actors.filter((actor) => visiblePerson(principal, actor) === null).map(({ id }) => id),
    );
    return events.map((event) => {
      const endUserEvent = toEndUserEvent(event, readableIds);
      return event.actor !== null && hiddenActorIds.has(event.actor.id)
        ? { ...endUserEvent, actor: null }
        : endUserEvent;
    });
  }
}
