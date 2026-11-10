import {
  type ListTicketsQuery,
  type SortOrder,
  TEAM_TICKET_LIST_PARAMETERS,
  TICKET_FILTER_ME,
  TICKET_FILTER_NONE,
  type TicketListFilters,
  type TicketListSort,
  ticketPrioritySchema,
  ticketStatusSchema,
} from '@trybun/contracts/tickets';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { assertNoTeamParameters } from '../../platform/http/team-parameters.js';

/**
 * `422 field.unrecognized` for the parameters of the team in an end user's request (S1-13 Q21):
 * an end user never filters or sorts their tickets by a field their response hides.
 */
export function assertNoTeamListParameters(query: ListTicketsQuery): void {
  assertNoTeamParameters(query, TEAM_TICKET_LIST_PARAMETERS);
}

/** The values of a filter that name records, and whether it also matches tickets without one. */
function splitNone<Value extends string>(
  values: readonly (Value | typeof TICKET_FILTER_NONE)[],
): { values: Value[]; none: boolean } {
  return {
    values: values.filter((value): value is Value => value !== TICKET_FILTER_NONE),
    none: values.includes(TICKET_FILTER_NONE),
  };
}

/** A nullable column matching some values, or no value with `none`. */
function nullableIn<Key extends 'organizationId' | 'type' | 'assigneeId'>(
  key: Key,
  { values, none }: { values: string[]; none: boolean },
): Prisma.TicketWhereInput {
  return {
    OR: [
      ...(values.length > 0 ? [{ [key]: { in: values } }] : []),
      ...(none ? [{ [key]: null }] : []),
    ],
  };
}

/**
 * The conditions of the filters of the ticket list (§8.1, S1-13): the values of one filter are
 * combined with OR, the filters with AND. They only narrow the `read` filter of the ability, so a
 * value of a record the principal cannot see matches no ticket and never widens the list (Q5).
 * `assigneeId=me` is the principal, `none` a ticket without the field.
 */
export function ticketListConditions(
  filters: TicketListFilters,
  principalUserId: string,
): Prisma.TicketWhereInput[] {
  const conditions: Prisma.TicketWhereInput[] = [];
  if (filters.projectId !== undefined) {
    conditions.push({ projectId: { in: filters.projectId } });
  }
  if (filters.organizationId !== undefined) {
    conditions.push(nullableIn('organizationId', splitNone(filters.organizationId)));
  }
  if (filters.type !== undefined) {
    conditions.push(nullableIn('type', splitNone(filters.type)));
  }
  if (filters.status !== undefined) {
    conditions.push({ status: { in: filters.status } });
  }
  if (filters.priority !== undefined) {
    conditions.push({ priority: { in: filters.priority } });
  }
  if (filters.assigneeId !== undefined) {
    const assignees = splitNone(filters.assigneeId);
    conditions.push(
      nullableIn('assigneeId', {
        none: assignees.none,
        values: assignees.values.map((value) =>
          value === TICKET_FILTER_ME ? principalUserId : value,
        ),
      }),
    );
  }
  if (filters.source !== undefined) {
    conditions.push({ source: { in: filters.source } });
  }
  if (filters.sharingRequest !== undefined) {
    conditions.push({ sharingRequest: { in: filters.sharingRequest } });
  }
  return conditions;
}

/** The fields of a row the sort keys of the list read. */
export interface SortableTicketRow {
  id: string;
  number: number;
  priority: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  project: { key: string };
}

/** One key of a keyset order: how rows after a value and rows with the value are found. */
interface SortKey<Value> {
  schema: z.ZodType<Value>;
  valueOf(row: SortableTicketRow): Value;
  orderBy(order: SortOrder): Prisma.TicketOrderByWithRelationInput;
  after(value: Value, order: SortOrder): Prisma.TicketWhereInput;
  equals(value: Value): Prisma.TicketWhereInput;
}

function comparison(order: SortOrder): 'lt' | 'gt' {
  return order === 'desc' ? 'lt' : 'gt';
}

/**
 * An enum key ordered by the declaration order of its PostgreSQL enum (S1-13 Q8): Prisma cannot
 * compare enums, so the rows after a value are those with one of the values that follow it.
 */
function enumKey<Field extends 'priority' | 'status'>(
  field: Field,
  values: readonly string[],
): SortKey<string> {
  return {
    schema: z.enum(values as [string, ...string[]]),
    valueOf: (row) => row[field],
    orderBy: (order) => ({ [field]: order }),
    after(value, order) {
      const index = values.indexOf(value);
      const following = order === 'desc' ? values.slice(0, index) : values.slice(index + 1);
      return { [field]: { in: following } };
    },
    equals: (value) => ({ [field]: value }),
  };
}

function dateKey(field: 'createdAt' | 'updatedAt'): SortKey<string> {
  return {
    schema: z.iso.datetime(),
    valueOf: (row) => row[field].toISOString(),
    orderBy: (order) => ({ [field]: order }),
    after: (value, order) => ({ [field]: { [comparison(order)]: new Date(value) } }),
    equals: (value) => ({ [field]: new Date(value) }),
  };
}

const ID_KEY: SortKey<string> = {
  schema: z.uuid(),
  valueOf: (row) => row.id,
  orderBy: (order) => ({ id: order }),
  after: (value, order) => ({ id: { [comparison(order)]: value } }),
  equals: (value) => ({ id: value }),
};

const PROJECT_KEY_KEY: SortKey<string> = {
  schema: z.string().min(1),
  valueOf: (row) => row.project.key,
  orderBy: (order) => ({ project: { key: order } }),
  after: (value, order) => ({ project: { is: { key: { [comparison(order)]: value } } } }),
  equals: (value) => ({ project: { is: { key: value } } }),
};

const NUMBER_KEY: SortKey<number> = {
  schema: z.int(),
  valueOf: (row) => row.number,
  orderBy: (order) => ({ number: order }),
  after: (value, order) => ({ number: { [comparison(order)]: value } }),
  equals: (value) => ({ number: value }),
};

/** A key with the direction it is ordered in. */
type OrderedKey = { key: SortKey<string> | SortKey<number>; order: SortOrder };

/**
 * The keys of each sort (S1-13 Q8): the chosen key, then the last update (newest first), then the
 * ID, so pages are stable. An identifier is unique: the project key, then the number.
 */
function keysOf(sort: TicketListSort, order: SortOrder): OrderedKey[] {
  const tiebreak: OrderedKey[] = [
    { key: dateKey('updatedAt'), order: 'desc' },
    { key: ID_KEY, order: 'desc' },
  ];
  switch (sort) {
    case 'priority':
      return [{ key: enumKey('priority', ticketPrioritySchema.options), order }, ...tiebreak];
    case 'status':
      return [{ key: enumKey('status', ticketStatusSchema.options), order }, ...tiebreak];
    case 'createdAt':
      return [{ key: dateKey('createdAt'), order }, ...tiebreak];
    case 'updatedAt':
      return [
        { key: dateKey('updatedAt'), order },
        { key: ID_KEY, order },
      ];
    case 'identifier':
      return [
        { key: PROJECT_KEY_KEY, order },
        { key: NUMBER_KEY, order },
      ];
  }
}

/**
 * A keyset order of the list (§18.4, S1-13): its `orderBy`, the condition of the rows after a
 * cursor and the cursor of a row. The cursor names the sort and the direction, so a cursor of
 * another order is rejected with `422` at `/cursor`, never read as a key of this one.
 */
export interface TicketListOrder {
  orderBy: Prisma.TicketOrderByWithRelationInput[];
  cursorSchema: z.ZodType<unknown[]>;
  after(cursor: unknown[]): Prisma.TicketWhereInput;
  cursorOf(row: SortableTicketRow): unknown[];
}

export function ticketListOrder(sort: TicketListSort, order: SortOrder): TicketListOrder {
  const keys = keysOf(sort, order);
  const items = [z.literal(sort), z.literal(order), ...keys.map(({ key }) => key.schema)];
  return {
    orderBy: keys.map(({ key, order: direction }) => key.orderBy(direction)),
    cursorSchema: z.tuple(items as [z.ZodType, ...z.ZodType[]]),
    // Rows after the cursor: equal in the first i keys and after it in key i, for some i.
    after(cursor) {
      const values = cursor.slice(2);
      return {
        OR: keys.map(({ key, order: direction }, index) => ({
          AND: [
            ...keys
              .slice(0, index)
              .map(({ key: previous }, previousIndex) =>
                (previous as SortKey<unknown>).equals(values[previousIndex]),
              ),
            (key as SortKey<unknown>).after(values[index], direction),
          ],
        })),
      };
    },
    cursorOf: (row) => [sort, order, ...keys.map(({ key }) => key.valueOf(row))],
  };
}
