import { faker } from '@faker-js/faker';
import type { Prisma, Project } from '../../src/generated/prisma/client.js';
import type { Transaction } from '../../src/platform/database/prisma.service.js';

/** A unique key of the pattern of §3.1, e.g. `P4K9ZQ2`. */
export function buildProjectKey(): string {
  return `P${faker.string.alphanumeric({ length: 9, casing: 'upper' })}`;
}

export function buildProject(
  overrides: Partial<Prisma.ProjectCreateInput> = {},
): Prisma.ProjectCreateInput {
  return {
    name: faker.company.name().slice(0, 100),
    key: buildProjectKey(),
    ...overrides,
  };
}

export function createProject(
  db: Transaction,
  overrides?: Partial<Prisma.ProjectCreateInput>,
): Promise<Project> {
  return db.project.create({ data: buildProject(overrides) });
}
