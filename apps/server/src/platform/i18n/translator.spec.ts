import { describe, expect, it } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';
import { loadConfig } from '../config/load-config.js';
import { compileMessage, Translator } from './translator.js';

const MOMENT = new Date('2026-11-03T23:15:00Z');

describe('compileMessage', () => {
  it.each([
    ['en', 'UTC', '{count, plural, one {# ticket} other {# tickets}}', { count: 1 }, '1 ticket'],
    [
      'pl',
      'UTC',
      '{count, plural, one {# zgłoszenie} few {# zgłoszenia} many {# zgłoszeń} other {# zgłoszenia}}',
      { count: 5 },
      '5 zgłoszeń',
    ],
    ['en', 'UTC', '{at, date, medium} {at, time, short}', { at: MOMENT }, 'Nov 3, 2026 11:15 PM'],
    [
      'pl',
      'Europe/Warsaw',
      '{at, date, medium} {at, time, short}',
      { at: MOMENT },
      '4 lis 2026 00:15',
    ],
    ['pl', 'Europe/Warsaw', '{at, date, ::yyyyMMdd}', { at: MOMENT }, '04.11.2026'],
    ['pl', 'UTC', '{amount, number}', { amount: 1234.5 }, '1234,5'],
    ['en', 'UTC', '{amount, number}', { amount: 1234.5 }, '1,234.5'],
  ] as const)('%s in %s: %s', (locale, timeZone, message, values, expected) => {
    expect(compileMessage(message, locale, timeZone)(values)).toBe(expected);
  });
});

describe('Translator', () => {
  const translator = new Translator(
    loadConfig({
      ...TEST_ENV,
      TRYBUN_DEFAULT_LANGUAGE: 'pl',
      TRYBUN_DEFAULT_TIME_ZONE: 'Europe/Warsaw',
    }),
  );

  it.each([
    ['en', 'en'],
    ['pl', 'pl'],
    ['de', 'pl'],
    [null, 'pl'],
    [undefined, 'pl'],
  ])('sends to a recipient with language %s in %s', (language, expected) => {
    expect(translator.localeOf(language)).toBe(expected);
  });

  it.each([
    ['en', 'This message was sent automatically by Trybun.'],
    ['pl', 'Ta wiadomość została wysłana automatycznie przez system Trybun.'],
  ] as const)('translates a message of the catalogues into %s', (locale, expected) => {
    expect(translator.translate(locale, 'emails.footer.automatic')).toBe(expected);
    // The second call uses the compiled message.
    expect(translator.translate(locale, 'emails.footer.automatic')).toBe(expected);
  });
});
