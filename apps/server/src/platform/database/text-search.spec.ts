import { describe, expect, it } from 'vitest';
import { containsText } from './text-search.js';

describe('containsText', () => {
  it('searches ignoring case', () => {
    expect(containsText('QM1')).toEqual({ contains: 'QM1', mode: 'insensitive' });
  });

  it.each([
    ['a_b', 'a\\_b'],
    ['100%', '100\\%'],
    ['C:\\temp', 'C:\\\\temp'],
  ])('escapes the wildcards of %s', (search, contains) => {
    expect(containsText(search).contains).toBe(contains);
  });
});
