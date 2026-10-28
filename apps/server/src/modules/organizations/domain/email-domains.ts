import { domainToASCII } from 'node:url';
import type { FieldError } from '@trybun/contracts/problem-details';
import { AppError } from '../../../platform/errors/app-error.js';
import publicMailDomainList from './public-mail-domains.json' with { type: 'json' };

/** The blocklist of public mail domains (§7.3); its source and update: `README.md` here. */
const PUBLIC_MAIL_DOMAINS: ReadonlySet<string> = new Set(publicMailDomainList);

/** A label of a host name: letters, digits and inner hyphens, at most 63 characters (RFC 1035). */
const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const MAX_DOMAIN_LENGTH = 253;

/**
 * The normalized form of an e-mail domain (§7.3): lower-case ASCII, an internationalized name in
 * its punycode form, at least two labels, no wildcard, no `@` and no trailing dot. `null` when the
 * input is not a domain.
 */
export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '' || trimmed.endsWith('.') || /[@*\s/:]/.test(trimmed)) {
    return null;
  }
  const ascii = domainToASCII(trimmed.toLowerCase());
  if (ascii === '' || ascii.length > MAX_DOMAIN_LENGTH) {
    return null;
  }
  const labels = ascii.split('.');
  if (labels.length < 2 || !labels.every((label) => LABEL_PATTERN.test(label))) {
    return null;
  }
  // A top-level domain is never numeric, so an IPv4 address is not a domain.
  if (/^\d+$/.test(labels.at(-1) ?? '')) {
    return null;
  }
  return ascii;
}

/** Whether a normalized domain is on the blocklist of public mail domains, e.g. `gmail.com`. */
export function isPublicMailDomain(domain: string): boolean {
  return PUBLIC_MAIL_DOMAINS.has(domain);
}

/**
 * The domains of an organization from the input of a request (§7.3), normalized and in the order
 * entered, so a later check still names the field of each (`/domains/<index>`); duplicates stay
 * for the caller to drop. A domain that is not one is rejected at its field, then a public mail
 * domain with `organization.domain_public`.
 */
export function parseDomains(inputs: readonly string[]): string[] {
  const normalized = inputs.map(normalizeDomain);
  const invalid = domainFieldErrors(
    normalized,
    (domain) => domain === null,
    'string.invalid_format',
  );
  if (invalid.length > 0) {
    throw new AppError('request.validation_failed', invalid);
  }
  const domains = normalized.filter((domain) => domain !== null);
  const blocked = domainFieldErrors(domains, isPublicMailDomain);
  if (blocked.length > 0) {
    throw new AppError('organization.domain_public', blocked);
  }
  return domains;
}

/**
 * The domain an e-mail address is matched by (§7.3): the normalized part after the last `@`, or
 * `null`. Matching is exact – `pl.company.com` does not match `company.com`.
 */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  return at < 1 ? null : normalizeDomain(email.slice(at + 1));
}

/** The field errors `/domains/<index>` of the domains that fail a check. */
export function domainFieldErrors<T>(
  domains: readonly T[],
  fails: (domain: T) => boolean,
  code: FieldError['code'] = 'field.invalid',
): FieldError[] {
  return domains.flatMap((domain, index) =>
    fails(domain) ? [{ pointer: `/domains/${index}`, code }] : [],
  );
}
