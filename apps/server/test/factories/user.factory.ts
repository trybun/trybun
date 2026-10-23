import { faker } from '@faker-js/faker';
import type { Prisma, User } from '../../src/generated/prisma/client.js';
import type { Transaction } from '../../src/platform/database/prisma.service.js';

export function buildUser(overrides: Partial<Prisma.UserCreateInput> = {}): Prisma.UserCreateInput {
  return {
    email: faker.internet.exampleEmail({ firstName: faker.string.alphanumeric(16) }).toLowerCase(),
    displayName: faker.person.fullName(),
    language: faker.helpers.arrayElement(['en', 'pl']),
    timeZone: 'Europe/Warsaw',
    kind: 'end_user',
    state: 'active',
    ...overrides,
  };
}

export function createUser(
  db: Transaction,
  overrides?: Partial<Prisma.UserCreateInput>,
): Promise<User> {
  return db.user.create({ data: buildUser(overrides) });
}
