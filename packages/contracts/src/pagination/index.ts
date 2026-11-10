import { z } from 'zod';

/**
 * The response envelope of every list endpoint (§12.1, §18.4): one page of items and the cursor
 * of the next page, `null` on the last page. A list bounded by a small closed set (e.g. the
 * product tours) returns all its items in one page.
 */
export function pageSchema<Item extends z.ZodType>(item: Item) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

/** The default and the largest number of items of one page (§18.4). */
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

/**
 * The query parameters of every list endpoint (§12.1, §18.4): the opaque `cursor` of the page,
 * as returned in `nextCursor` (none for the first page), and the number of items per page.
 */
export const pageQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

/**
 * The largest number of values of one multi-valued query parameter: a filter of the ticket list
 * (S1-13) or the IDs of a lookup of a list (`id`, `projectId`, `userId`).
 */
export const MAX_TICKET_FILTER_VALUES = 50;

/**
 * A query parameter with one or more values (S1-13): repeated (`status=new&status=triage`) or
 * once; the values of one parameter are combined with OR.
 */
export function oneOrMore<Item extends z.ZodType>(item: Item) {
  return z
    .union([item, z.array(item).min(1).max(MAX_TICKET_FILTER_VALUES)])
    .transform((value): z.output<Item>[] => (Array.isArray(value) ? value : [value]));
}

/** The longest search text of a list (`query`): the pickers of members, projects, organizations. */
export const LIST_SEARCH_QUERY_MAX_LENGTH = 100;

/**
 * The search text of a list (`query`): trimmed; a blank one is no search. The list keeps the
 * records whose searched fields contain it, ignoring case, taken literally (no wildcards).
 */
export const listSearchQuerySchema = z
  .string()
  .trim()
  .max(LIST_SEARCH_QUERY_MAX_LENGTH)
  .transform((value) => (value === '' ? undefined : value))
  .optional();
