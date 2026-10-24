// Deterministic demo dataset of the local environment and the E2E tests (§15.12): fixed IDs,
// fixed timestamps and a seeded Faker, so two runs load identical data.
import { base, en, Faker, pl } from '@faker-js/faker';
import type { ProductTourId } from '@trybun/contracts/product-tours';
import type { Prisma, PrismaClient } from '../src/generated/prisma/client.js';

const FAKER_SEED = 20_261_023;
const CREATED_AT = new Date('2026-01-05T08:00:00.000Z');
const END_USER_COUNT = 10;
/** The account without tour progress, for trying the product tours and their E2E tests (§2.4). */
export const NEWCOMER_EMAIL = 'newcomer@example.com';
/**
 * The current version of every product tour (`apps/web/src/features/product-tours/tours/`): the
 * other team accounts have completed them, so the tours interrupt neither demos nor E2E tests.
 */
const PRODUCT_TOUR_VERSIONS: Record<ProductTourId, number> = { first_login: 1 };

export interface DemoDataset {
  users: Prisma.UserCreateManyInput[];
  productTourProgress: Prisma.ProductTourProgressCreateManyInput[];
}

/** UUIDv7 of the demo record number `n` (§17.2). */
export function demoId(n: number): string {
  return `019b8d00-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;
}

export function buildDemoDataset(): DemoDataset {
  const faker = new Faker({ locale: [pl, en, base], seed: FAKER_SEED });
  // Team accounts sign in with a password in the local environment only (§7.4); their Keycloak
  // users have the same IDs (docker/keycloak/dev/trybun-realm.json).
  const team: Prisma.UserCreateManyInput[] = [
    { email: 'admin@example.com', displayName: 'Ada Admin', isAdmin: true },
    { email: 'manager@example.com', displayName: 'Marek Manager' },
    { email: 'developer@example.com', displayName: 'Dorota Developer' },
    { email: NEWCOMER_EMAIL, displayName: 'Nina Newcomer' },
  ].map((account, index) => ({
    ...account,
    id: demoId(index + 1),
    keycloakUserId: demoId(index + 1),
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
  const productTourProgress = team
    .filter((account) => account.email !== NEWCOMER_EMAIL)
    .flatMap((account) =>
      Object.entries(PRODUCT_TOUR_VERSIONS).map(([tourId, tourVersion]) => ({
        userId: account.id ?? '',
        tourId,
        tourVersion,
        status: 'completed' as const,
        updatedAt: CREATED_AT,
      })),
    )
    .map((progress, index) => ({ ...progress, id: demoId(200 + index) }));
  return { users: [...team, ...endUsers], productTourProgress };
}

/**
 * Loads the demo dataset; running it again restores the same records – also the tour progress,
 * so the newcomer sees the tours again.
 */
export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  const { users, productTourProgress } = buildDemoDataset();
  await prisma.$transaction(async (tx) => {
    for (const user of users) {
      await tx.user.upsert({ where: { id: user.id }, create: user, update: user });
    }
    await tx.productTourProgress.deleteMany({
      where: { userId: { in: users.map((user) => user.id ?? '') } },
    });
    await tx.productTourProgress.createMany({ data: productTourProgress });
  });
}
