import { describe, expect, it } from 'vitest';
import { JsonSyntaxCheck } from './json-syntax.js';

/** Checks a text given in parts of `partSize` characters. */
function isJson(text: string, partSize = 1): boolean {
  const check = new JsonSyntaxCheck();
  for (let start = 0; start < text.length; start += partSize) {
    if (!check.write(text.slice(start, start + partSize))) {
      return false;
    }
  }
  return check.end();
}

const VALID = [
  '0',
  '-0',
  '12',
  '-3.25e+10',
  '1E-2',
  '0.5',
  'true',
  'false',
  'null',
  '""',
  '"a \\"quoted\\" \\\\ \\/ \\b\\f\\n\\r\\t \\u00e9 \\uD83D\\uDE00"',
  '"😀 zażółć"',
  '[]',
  '{}',
  ' \t\r\n[ 1 , [ ] , { } ] \n',
  '{"a":{"b":[true,false,null,{"c":"d"}]},"e":-1.5}',
  '[[[[[[[[[[1]]]]]]]]]]',
];

const INVALID = [
  '',
  '   ',
  '01',
  '-',
  '1.',
  '.5',
  '1e',
  '1e+',
  '+1',
  '0x10',
  'NaN',
  'tru',
  'True',
  'nul',
  '"unterminated',
  '"tab\there"',
  '"\\x"',
  '"\\u12g4"',
  '[1,]',
  '[,1]',
  '{"a" 1}',
  '{"a":}',
  '{"a":1,}',
  '{a:1}',
  "{'a':1}",
  '[1}',
  '{"a":1]',
  '[1] [2]',
  '1 2',
  '{} x',
  '[',
  '{"a":[1,{"b":2}]',
  ']',
];

describe('JsonSyntaxCheck (attachment serving item 1)', () => {
  it.each(VALID)('accepts %s', (text) => {
    expect(isJson(text)).toBe(true);
    expect(isJson(text, 7)).toBe(true);
  });

  it.each(INVALID)('refuses %j', (text) => {
    expect(isJson(text)).toBe(false);
  });

  it.each([...VALID, ...INVALID])('agrees with JSON.parse on %j', (text) => {
    let isParsed = true;
    try {
      JSON.parse(text);
    } catch {
      isParsed = false;
    }
    expect(isJson(text)).toBe(isParsed);
  });

  it('checks a deeply nested text without a stack per level', () => {
    const depth = 100_000;

    expect(isJson(`${'['.repeat(depth)}${']'.repeat(depth)}`, 4096)).toBe(true);
    expect(isJson(`${'{"a":'.repeat(depth)}1${'}'.repeat(depth)}`, 4096)).toBe(true);
    expect(isJson(`${'['.repeat(depth)}${']'.repeat(depth - 1)}`, 4096)).toBe(false);
  });
});
