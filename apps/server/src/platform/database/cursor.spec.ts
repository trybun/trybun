import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { decodeCursor, encodeCursor, toPage } from './cursor.js';

const sortKeySchema = z.tuple([z.string(), z.uuid()]);
const ID = '0190f2f4-7c1e-7000-8000-000000000001';

describe('cursor', () => {
  it('decodes the sort key it encoded', () => {
    expect(decodeCursor(encodeCursor(['ERP', ID]), sortKeySchema)).toEqual(['ERP', ID]);
  });

  it('starts at the first page without a cursor', () => {
    expect(decodeCursor(undefined, sortKeySchema)).toBeNull();
  });

  it.each([
    ['not base64url JSON', '%%%'],
    ['a key of another list', encodeCursor([1, 2])],
  ])('rejects %s with 422 at /cursor', (_case, cursor) => {
    expect(() => decodeCursor(cursor, sortKeySchema)).toThrow(
      expect.objectContaining({
        code: 'request.validation_failed',
        errors: [{ pointer: '/cursor', code: 'field.invalid' }],
      }) as AppError,
    );
  });

  it.each([
    [[1, 2, 3], 2, [1, 2], true],
    [[1, 2], 2, [1, 2], false],
    [[], 2, [], false],
  ])('pages %j by %i', (rows, limit, items, hasNext) => {
    const page = toPage(rows, limit, (row) => row, (row) => [row]);

    expect(page.items).toEqual(items);
    expect(page.nextCursor === null).toBe(!hasNext);
  });
});
