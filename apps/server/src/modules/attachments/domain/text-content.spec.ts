import { describe, expect, it } from 'vitest';
import { TextContentCheck } from './text-content.js';

/** Checks content split into chunks of `chunkSize` bytes. */
function check(content: Buffer, { isJson = false, chunkSize = 3 } = {}): boolean {
  const textCheck = new TextContentCheck({ isJson });
  for (let start = 0; start < content.length; start += chunkSize) {
    textCheck.write(content.subarray(start, start + chunkSize));
  }
  return textCheck.end();
}

const utf8 = (text: string) => Buffer.from(text, 'utf8');

describe('TextContentCheck (attachment serving item 1)', () => {
  it.each([
    ['ASCII', utf8('id,name\n1,Anna\n')],
    ['multi-byte characters split between chunks', utf8('Zażółć gęślą jaźń 😀')],
    ['a byte order mark', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), utf8('text')])],
    ['an empty file', Buffer.alloc(0)],
  ])('accepts %s', (_case, content) => {
    expect(check(content)).toBe(true);
  });

  it.each([
    ['a NUL byte', utf8('a\u0000b')],
    ['invalid UTF-8', Buffer.from([0x61, 0xff, 0x62])],
    ['a truncated multi-byte character', Buffer.from([0x61, 0xc5])],
    ['binary content', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
  ])('refuses %s', (_case, content) => {
    expect(check(content)).toBe(false);
  });

  it('checks JSON when asked to', () => {
    expect(check(utf8('{"a": [1, 2]}'), { isJson: true })).toBe(true);
    expect(check(utf8('{"a": [1, 2]'), { isJson: true })).toBe(false);
    expect(check(utf8('{"a": [1, 2]'))).toBe(true);
  });

  it('accepts JSON after a byte order mark', () => {
    const content = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), utf8('[]')]);

    expect(check(content, { isJson: true })).toBe(true);
  });
});
