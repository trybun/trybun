import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  LIST_SEARCH_QUERY_MAX_LENGTH,
  listSearchQuerySchema,
  MAX_TICKET_FILTER_VALUES,
  oneOrMore,
  pageQuerySchema,
  pageSchema,
} from './index.js';

describe('pageSchema', () => {
  const page = pageSchema(z.object({ id: z.string() }));

  it.each([
    [{ items: [{ id: 'a' }], nextCursor: 'b' }, true],
    [{ items: [], nextCursor: null }, true],
    [{ items: [{ id: 1 }], nextCursor: null }, false],
    [{ items: [] }, false],
  ])('accepts %j: %s', (input, isValid) => {
    expect(page.safeParse(input).success).toBe(isValid);
  });
});

describe('pageQuerySchema', () => {
  it.each([
    [{}, { limit: 50 }],
    [
      { limit: '20', cursor: 'abc' },
      { limit: 20, cursor: 'abc' },
    ],
  ])('parses %j', (input, output) => {
    expect(pageQuerySchema.parse(input)).toEqual(output);
  });

  it.each([[{ limit: '0' }], [{ limit: '101' }], [{ limit: '1.5' }], [{ cursor: '' }]])(
    'rejects %j',
    (input) => {
      expect(pageQuerySchema.safeParse(input).success).toBe(false);
    },
  );
});

describe('oneOrMore', () => {
  const ids = oneOrMore(z.uuid());
  const id = '0190a7e4-3c1e-7a00-8000-000000000001';

  it('reads a single value as a list', () => {
    expect(ids.parse(id)).toEqual([id]);
  });

  it('keeps repeated values', () => {
    expect(ids.parse([id, id])).toEqual([id, id]);
  });

  it.each([
    ['no value', []],
    ['more than the limit', Array<string>(MAX_TICKET_FILTER_VALUES + 1).fill(id)],
    ['an invalid value', ['not-a-uuid']],
  ])('rejects %s', (_, input) => {
    expect(ids.safeParse(input).success).toBe(false);
  });

  it(`accepts ${String(MAX_TICKET_FILTER_VALUES)} values`, () => {
    expect(ids.parse(Array<string>(MAX_TICKET_FILTER_VALUES).fill(id))).toHaveLength(
      MAX_TICKET_FILTER_VALUES,
    );
  });
});

describe('listSearchQuerySchema', () => {
  it('trims the search text', () => {
    expect(listSearchQuerySchema.parse('  qm1 ')).toBe('qm1');
  });

  it.each([[''], ['   '], [undefined]])('reads %j as no search', (input) => {
    expect(listSearchQuerySchema.parse(input)).toBeUndefined();
  });

  it('rejects a text longer than the limit', () => {
    expect(listSearchQuerySchema.safeParse('a'.repeat(LIST_SEARCH_QUERY_MAX_LENGTH + 1)).success).toBe(
      false,
    );
  });
});
