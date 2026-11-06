import { describe, expect, it } from 'vitest';
import { normalizeFileName } from './file-name.js';

describe('normalizeFileName (§13.3)', () => {
  it.each([
    ['keeps a plain name', 'report.pdf', 'report.pdf'],
    // "ó" as "o" with a combining acute accent becomes one character.
    ['composes Unicode to NFC', 'zółw.txt', 'zółw.txt'],
    ['removes control characters', 're\u0000po\u001frt\u007f.pdf', 'report.pdf'],
    ['replaces path separators', '../etc\\passwd.txt', '.._etc_passwd.txt'],
    ['trims whitespace', '  notes.txt \n', 'notes.txt'],
  ])('%s', (_case, clientName, expected) => {
    expect(normalizeFileName(clientName)).toBe(expected);
  });

  it.each(['', '   ', '\u0000\u0001'])('gives nothing for %j', (clientName) => {
    expect(normalizeFileName(clientName)).toBeNull();
  });

  it('shortens a long name before its extension to 255 characters', () => {
    const name = normalizeFileName(`${'a'.repeat(300)}.xlsx`);

    expect(name).toBe(`${'a'.repeat(250)}.xlsx`);
  });

  it('counts characters outside the Basic Multilingual Plane once and never splits them', () => {
    const name = normalizeFileName(`${'😀'.repeat(300)}.png`) ?? '';

    expect(Array.from(name)).toHaveLength(255);
    expect(name).toBe(`${'😀'.repeat(251)}.png`);
  });

  it('trims the shortened stem', () => {
    expect(normalizeFileName(`${'a'.repeat(249)}      b.txt`)).toBe(`${'a'.repeat(249)}.txt`);
  });

  it('shortens a name without extension', () => {
    expect(normalizeFileName('b'.repeat(256))).toBe('b'.repeat(255));
  });
});
