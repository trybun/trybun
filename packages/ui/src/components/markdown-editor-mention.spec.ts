import { describe, expect, it } from 'vitest';
import { mentionQueryAt, mentionToken } from './markdown-editor-mention.js';

describe('mentionQueryAt', () => {
  it.each([
    ['@', 1, { start: 0, query: '' }],
    ['@an', 3, { start: 0, query: 'an' }],
    ['Hi @an', 6, { start: 3, query: 'an' }],
    ['Hi\n@an', 6, { start: 3, query: 'an' }],
    ['Hi @anna and more', 8, { start: 3, query: 'anna' }],
    ['Hi @zoë', 7, { start: 3, query: 'zoë' }],
    ['Hi @anna', 5, { start: 3, query: 'a' }],
  ])('%j at %i → %j', (text, caret, expected) => {
    expect(mentionQueryAt(text, caret)).toEqual(expected);
  });

  it.each([
    ['no @', 'Hello', 5],
    ['an e-mail address', 'mail@example', 12],
    ['after the query and a space', 'Hi @anna ', 9],
    ['a typed token', '@{3f2a1b4c', 10],
    ['a second @', '@@an', 4],
    ['a query too long', `@${'a'.repeat(51)}`, 52],
    ['an @ glued to text beyond the window', `${'x'.repeat(60)}@an`, 63],
    ['the caret before the @', 'Hi @an', 3],
  ])('none for %s', (_, text, caret) => {
    expect(mentionQueryAt(text, caret)).toBeUndefined();
  });

  it('finds a query of the longest length', () => {
    const query = 'a'.repeat(50);
    expect(mentionQueryAt(`x @${query}`, 53)).toEqual({ start: 2, query });
  });
});

describe('mentionToken', () => {
  it('writes the token with a space after it', () => {
    expect(mentionToken('customer')).toBe('@{customer} ');
  });
});
