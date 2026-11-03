import { describe, expect, it } from 'vitest';
import { splitDomains } from './domains.js';
import { organizationHref, organizationsSearchParamsSchema } from './search-params.js';

describe('organizations search params', () => {
  it.each([
    [{}, 'active'],
    [{ state: 'archived' }, 'archived'],
    [{ state: 'deleted' }, 'active'],
    [{ state: ['archived', 'active'] }, 'active'],
  ])('reads %j as the %s tab', (params, state) => {
    expect(organizationsSearchParamsSchema.parse(params)).toEqual({ state });
  });

  it('links an organization in the Administrator panel', () => {
    expect(organizationHref('o1')).toBe('/admin/organizations/o1');
  });
});

describe('splitDomains', () => {
  it.each([
    ['', []],
    ['company.com', ['company.com']],
    [
      ' company.com, company.pl ;shop.company.com  company.com',
      ['company.com', 'company.pl', 'shop.company.com'],
    ],
    [',, ', []],
  ])('reads %j as %j', (text, domains) => {
    expect(splitDomains(text)).toEqual(domains);
  });
});
