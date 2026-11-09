import type { z } from 'zod';
import { AppError } from '../errors/app-error.js';

/**
 * Keyset pagination of list endpoints (§12.1, §18.4): the cursor is the sort key of the last item
 * of a page, opaque to clients (base64url JSON). A query reads one item more than the limit to know
 * whether a next page exists.
 */
export function encodeCursor(sortKey: unknown): string {
  return Buffer.from(JSON.stringify(sortKey)).toString('base64url');
}

/**
 * The sort key of a cursor, checked with the schema of its list; a cursor that is not one of the
 * list returns `422` at `/cursor`.
 */
export function decodeCursor<Key>(cursor: string | undefined, schema: z.ZodType<Key>): Key | null {
  if (cursor === undefined) {
    return null;
  }
  try {
    const key = schema.safeParse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    if (key.success) {
      return key.data;
    }
  } catch {
    // Not base64url JSON: answered below like a key of another list.
  }
  throw new AppError('request.validation_failed', [{ pointer: '/cursor', code: 'field.invalid' }]);
}

/**
 * One page of a list read with `take: limit + 1`: the items, and the cursor of the last item when
 * more items follow.
 */
export function toPage<Row, Item>(
  rows: readonly Row[],
  limit: number,
  toItem: (row: Row) => Item,
  sortKeyOf: (row: Row) => unknown,
): { items: Item[]; nextCursor: string | null } {
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map(toItem),
    nextCursor: rows.length > limit && last !== undefined ? encodeCursor(sortKeyOf(last)) : null,
  };
}
