import { faker } from '@faker-js/faker';
import type { Organization, Prisma } from '../../src/generated/prisma/client.js';
import type { Transaction } from '../../src/platform/database/prisma.service.js';

/** A unique e-mail domain that is not on the blocklist, e.g. `k3j9x2qa.example`. */
export function buildOrganizationDomain(): string {
  return `${faker.string.alphanumeric({ length: 12, casing: 'lower' })}.example`;
}

export function buildOrganization(
  overrides: Partial<Prisma.OrganizationCreateInput> = {},
): Prisma.OrganizationCreateInput {
  return {
    // A random suffix keeps the case-insensitively unique names apart in parallel tests.
    name: `${faker.company.name().slice(0, 80)} ${faker.string.alphanumeric(8)}`,
    ...overrides,
  };
}

export function createOrganization(
  db: Transaction,
  overrides?: Partial<Prisma.OrganizationCreateInput>,
): Promise<Organization> {
  return db.organization.create({ data: buildOrganization(overrides) });
}
