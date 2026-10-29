import { describe, expect, it } from 'vitest';
import { AppError } from '../../../platform/errors/app-error.js';
import { emailDomain, isPublicMailDomain, normalizeDomain, parseDomains } from './email-domains.js';

describe('normalizeDomain', () => {
  it.each([
    ['company.com', 'company.com'],
    ['  Company.COM ', 'company.com'],
    ['pl.company.com', 'pl.company.com'],
    ['my-company.co.uk', 'my-company.co.uk'],
    ['bücher.de', 'xn--bcher-kva.de'],
    ['BÜCHER.de', 'xn--bcher-kva.de'],
    ['xn--bcher-kva.de', 'xn--bcher-kva.de'],
    ['żółw.pl', 'xn--w-uga1v8h.pl'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each([
    '',
    'company',
    'company.com.',
    '.company.com',
    '*.company.com',
    'anna@company.com',
    '@company.com',
    'company..com',
    '-company.com',
    'company-.com',
    'comp any.com',
    'company.com/path',
    'https://company.com',
    '192.168.0.1',
    `${'a'.repeat(64)}.com`,
    `${'a.'.repeat(127)}com`,
  ])('%j is not a domain', (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });
});

describe('isPublicMailDomain', () => {
  it.each(['gmail.com', 'outlook.com', 'yahoo.com', 'wp.pl', 'o2.pl', 'onet.pl', 'interia.pl'])(
    '%s is public',
    (domain) => {
      expect(isPublicMailDomain(domain)).toBe(true);
    },
  );

  it.each(['company.com', 'acme.example', 'pl.gmail-business.example'])(
    '%s is not public',
    (domain) => {
      expect(isPublicMailDomain(domain)).toBe(false);
    },
  );
});

describe('parseDomains', () => {
  it('normalizes the domains in the order entered', () => {
    expect(parseDomains(['Company.com', 'bücher.de', 'company.com'])).toEqual([
      'company.com',
      'xn--bcher-kva.de',
      'company.com',
    ]);
  });

  it('rejects a domain that is not one at its field', () => {
    expect(() => parseDomains(['company.com', '*.company.com'])).toThrow(
      expect.objectContaining({
        code: 'request.validation_failed',
        errors: [{ pointer: '/domains/1', code: 'string.invalid_format' }],
      }) as AppError,
    );
  });

  it.each(['gmail.com', 'GMAIL.COM', ' Gmail.Com '])(
    'rejects the public mail domain %j with organization.domain_public',
    (domain) => {
      expect(() => parseDomains(['company.com', domain])).toThrow(
        expect.objectContaining({
          code: 'organization.domain_public',
          errors: [{ pointer: '/domains/1', code: 'field.invalid' }],
        }) as AppError,
      );
    },
  );
});

describe('emailDomain', () => {
  it.each([
    ['anna@company.com', 'company.com'],
    ['Anna@Company.COM', 'company.com'],
    ['anna@pl.company.com', 'pl.company.com'],
    ['"a@b"@company.com', 'company.com'],
    ['anna@bücher.de', 'xn--bcher-kva.de'],
    ['anna', null],
    ['@company.com', null],
    ['anna@', null],
  ])('%j → %j', (email, expected) => {
    expect(emailDomain(email)).toBe(expected);
  });
});
