// Deterministic demo dataset of the local environment and the E2E tests (§15.12): fixed IDs,
// fixed timestamps and a seeded Faker, so two runs load identical data.
import { base, en, Faker, pl } from '@faker-js/faker';
import type { Prisma, PrismaClient } from '../src/generated/prisma/client.js';

const FAKER_SEED = 20_261_023;
const CREATED_AT = new Date('2026-01-05T08:00:00.000Z');
const END_USER_COUNT = 10;

export interface DemoDataset {
  users: Prisma.UserCreateManyInput[];
}

/** UUIDv7 of the demo record number `n` (§17.2). */
export function demoId(n: number): string {
  return `019b8d00-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;
}

export function buildDemoDataset(): DemoDataset {
  const faker = new Faker({ locale: [pl, en, base], seed: FAKER_SEED });
  // Team accounts sign in with a password in the local environment only (§7.4).
  const team: Prisma.UserCreateManyInput[] = [
    { email: 'admin@example.com', displayName: 'Ada Admin', isAdmin: true },
    { email: 'manager@example.com', displayName: 'Marek Manager' },
    { email: 'developer@example.com', displayName: 'Dorota Developer' },
  ].map((account, index) => ({
    ...account,
    id: demoId(index + 1),
    kind: 'team',
    state: 'active',
    language: 'pl',
    timeZone: 'Europe/Warsaw',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }));
  const endUsers = Array.from(
    { length: END_USER_COUNT },
    (_, index): Prisma.UserCreateManyInput => {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      return {
        id: demoId(100 + index),
        email: faker.internet
          .email({ firstName, lastName, provider: 'customer.example.com' })
          .toLowerCase(),
        displayName: `${firstName} ${lastName}`,
        kind: 'end_user',
        state: 'active',
        language: faker.helpers.arrayElement(['pl', 'en']),
        timeZone: 'Europe/Warsaw',
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      };
    },
  );
  return { users: [...team, ...endUsers] };
}

/** Loads the demo dataset; running it again restores the same records. */
export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  const { users } = buildDemoDataset();
  await prisma.$transaction(async (tx) => {
    for (const user of users) {
      await tx.user.upsert({ where: { id: user.id }, create: user, update: user });
    }
  });
}
