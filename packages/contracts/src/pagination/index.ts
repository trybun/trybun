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
