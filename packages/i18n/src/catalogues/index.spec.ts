import { describe, expect, it } from 'vitest';
import { isLocale, LOCALES, negotiateLocale } from './index.js';

describe('LOCALES', () => {
  it('lists English and Polish', () => {
    expect(LOCALES).toEqual(['en', 'pl']);
  });
});

describe('isLocale', () => {
  it.each([
    ['en', true],
    ['pl', true],
    ['de', false],
    ['EN', false],
    ['toString', false],
    [undefined, false],
  ])('%s → %s', (value, expected) => {
    expect(isLocale(value)).toBe(expected);
  });
});

describe('negotiateLocale', () => {
  it.each([
    ['pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7', 'pl'],
    ['en-GB', 'en'],
    ['de-DE,de;q=0.9,pl;q=0.5,en;q=0.4', 'pl'],
    ['en;q=0.5, pl;q=0.8', 'pl'],
    ['en, pl', 'en'],
    ['PL', 'pl'],
    ['pl;q=0, en;q=0.1', 'en'],
    ['de, *', undefined],
    ['pl;q=abc', undefined],
    ['', undefined],
    [null, undefined],
    [undefined, undefined],
  ])('%j → %s', (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected);
  });
});
