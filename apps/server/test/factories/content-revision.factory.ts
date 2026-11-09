import { faker } from '@faker-js/faker';
import type { ContentRevision, Prisma } from '../../src/generated/prisma/client.js';
import type { Transaction } from '../../src/platform/database/prisma.service.js';

export type ContentRevisionFactoryInput = Omit<
  Prisma.ContentRevisionUncheckedCreateInput,
  'body' | 'writtenAt'
> &
  Partial<Pick<Prisma.ContentRevisionUncheckedCreateInput, 'body' | 'writtenAt'>>;

/** An earlier version of a comment or a description: the overrides name exactly one parent. */
export function createContentRevision(
  db: Transaction,
  input: ContentRevisionFactoryInput,
): Promise<ContentRevision> {
  return db.contentRevision.create({
    data: { body: faker.lorem.paragraph(), writtenAt: faker.date.recent(), ...input },
  });
}
