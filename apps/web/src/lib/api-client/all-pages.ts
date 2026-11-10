/** One page of a list endpoint in the cursor envelope (§18.4). */
interface CursorPage<Item> {
  items: Item[];
  nextCursor: string | null;
}

/** The pages of a whole list read at most: 20 pages of 100 (§8.1). */
export const ALL_PAGES_MAX_PAGES = 20;

/**
 * The items of every page of a list endpoint (§18.4, §18.5): `fetchPage` is called with `null`,
 * then with each `nextCursor`, one page after another, until the last page or `maxPages` pages.
 * A failed page rejects the whole read, so a list is never silently partial.
 */
export async function allPageItems<Item>(
  fetchPage: (cursor: string | null) => Promise<CursorPage<Item>>,
  { maxPages = ALL_PAGES_MAX_PAGES }: { maxPages?: number } = {},
): Promise<Item[]> {
  const items: Item[] = [];
  let cursor: string | null = null;
  for (let pages = 0; pages < maxPages; pages += 1) {
    const page: CursorPage<Item> = await fetchPage(cursor);
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor === null) {
      break;
    }
  }
  return items;
}
