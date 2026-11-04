import { Injectable } from '@nestjs/common';
import type {
  ActivityEvent,
  ActivityEventPage,
  ActivityEventSource,
  ListActivityEventsQuery,
} from '@trybun/contracts/activity-events';
import {
  activityEventDataSchema,
  activityEventTypeSchema,
} from '@trybun/contracts/activity-events';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { decodeCursor, toPage } from '../../platform/database/cursor.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
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
const eventSortKeySchema = z.tuple([z.uuid()]);

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
   * The events of a ticket, oldest first. The caller has checked that the principal may read the
   * ticket; `publicOnly` keeps the events end users may see (§4.5).
   */
  async list(
    ticketId: string,
    query: ListActivityEventsQuery,
    options: { publicOnly: boolean },
  ): Promise<ActivityEventPage> {
    const after = decodeCursor(query.cursor, eventSortKeySchema);
    const rows = await this.prisma.activityEvent.findMany({
      where: {
        ticketId,
        ...(options.publicOnly ? { isPublic: true } : {}),
        ...(after === null ? {} : { id: { gt: after[0] } }),
      },
      select: EVENT_SELECT,
      orderBy: { id: 'asc' },
      take: query.limit + 1,
    });
    return toPage(rows, query.limit, toEventResponse, (row) => [row.id]);
  }
}
