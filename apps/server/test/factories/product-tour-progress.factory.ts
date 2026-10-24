import { faker } from '@faker-js/faker';
import { productTourIdSchema } from '@trybun/contracts/product-tours';
import type { Prisma, ProductTourProgress } from '../../src/generated/prisma/client.js';
import type { Transaction } from '../../src/platform/database/prisma.service.js';

export function buildProductTourProgress(
  userId: string,
  overrides: Partial<Prisma.ProductTourProgressUncheckedCreateInput> = {},
): Prisma.ProductTourProgressUncheckedCreateInput {
  return {
    userId,
    tourId: faker.helpers.arrayElement(productTourIdSchema.options),
    tourVersion: 1,
    status: faker.helpers.arrayElement(['completed', 'skipped'] as const),
    ...overrides,
  };
}

export function createProductTourProgress(
  db: Transaction,
  userId: string,
  overrides?: Partial<Prisma.ProductTourProgressUncheckedCreateInput>,
): Promise<ProductTourProgress> {
  return db.productTourProgress.create({ data: buildProductTourProgress(userId, overrides) });
}
