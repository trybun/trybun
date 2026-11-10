import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors/api-error.js';
import { ALL_PAGES_MAX_PAGES, allPageItems } from './all-pages.js';

/** A list of `count` numbers served in pages of `size`, the cursor being the next offset. */
function pagedList(count: number, size: number) {
  return vi.fn((cursor: string | null) => {
    const offset = cursor === null ? 0 : Number(cursor);
    const end = Math.min(offset + size, count);
    return Promise.resolve({
      items: Array.from({ length: end - offset }, (_, index) => offset + index),
      nextCursor: end < count ? String(end) : null,
    });
  });
}

describe('allPageItems', () => {
  it('reads a list of one page with one request', async () => {
    const fetchPage = pagedList(3, 100);

    await expect(allPageItems(fetchPage)).resolves.toEqual([0, 1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(null);
  });

  it('follows the cursor through every page, in order', async () => {
    const fetchPage = pagedList(250, 100);

    const items = await allPageItems(fetchPage);

    expect(items).toEqual(Array.from({ length: 250 }, (_, index) => index));
    expect(fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual([null, '100', '200']);
  });

  it('stops after the bound of pages', async () => {
    const fetchPage = pagedList(10_000, 100);

    const items = await allPageItems(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(ALL_PAGES_MAX_PAGES);
    expect(items).toHaveLength(ALL_PAGES_MAX_PAGES * 100);
  });

  it('takes a bound of its own', async () => {
    const fetchPage = pagedList(10, 2);

    await expect(allPageItems(fetchPage, { maxPages: 2 })).resolves.toEqual([0, 1, 2, 3]);
  });

  it('rejects when a page fails, never returning a partial list', async () => {
    const error = new ApiError(500, 'server.internal_error');
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [1], nextCursor: 'next' })
      .mockRejectedValueOnce(error);

    await expect(allPageItems(fetchPage)).rejects.toBe(error);
  });
});
