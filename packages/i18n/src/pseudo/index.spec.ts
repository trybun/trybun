import { describe, expect, it } from 'vitest';
import { CATALOGUES, LOCALES, negotiateLocale } from '../catalogues/index.js';
import { isPseudoLocale, negotiateRequestLocale, productLocale, PSEUDO_LOCALE } from './index.js';

describe('the pseudo-locale', () => {
  it('is not a language of the product', () => {
    expect(LOCALES).not.toContain(PSEUDO_LOCALE);
    expect(Object.keys(CATALOGUES)).not.toContain(PSEUDO_LOCALE);
    expect(isPseudoLocale(PSEUDO_LOCALE)).toBe(true);
    expect(isPseudoLocale('en')).toBe(false);
  });

  it('stands for English outside the catalogues', () => {
    expect(productLocale(PSEUDO_LOCALE)).toBe('en');
    expect(productLocale('pl')).toBe('pl');
  });
});

describe('negotiateRequestLocale', () => {
  it.each([
    ['en-XA', 'en-XA'],
    ['EN-xa', 'en-XA'],
    ['en-XA,pl;q=0.9', 'en-XA'],
    ['pl,en-XA;q=0.5', 'pl'],
    ['de,en-XA;q=0.5,en;q=0.4', 'en-XA'],
    ['en,en-XA', 'en'],
    ['', undefined],
  ])('enabled: %j → %s', (header, expected) => {
    expect(negotiateRequestLocale(header, true)).toBe(expected);
  });

  it.each([
    'en-XA',
    'en-XA,pl;q=0.9',
    'pl,en-XA;q=0.5',
    'de, *',
    'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    '',
  ])('disabled: %j negotiates like the catalogues', (header) => {
    expect(negotiateRequestLocale(header, false)).toBe(negotiateLocale(header));
  });
});
