import { faker } from '@faker-js/faker';
import type { Comment, Prisma } from '../../src/generated/prisma/client.js';
import type { Transaction } from '../../src/platform/database/prisma.service.js';

export type CommentFactoryInput = Omit<
  Prisma.CommentUncheckedCreateInput,
  'kind' | 'body' | 'audience'
> &
  Partial<Pick<Prisma.CommentUncheckedCreateInput, 'kind' | 'body' | 'audience'>>;

/**
 * A comment of a ticket: a public comment with the audience `only_me` unless the overrides give
 * another kind or audience. An internal note gets no audience; `my_organization` needs the
 * `audienceOrganizationId` override (the check constraints of the migration).
 */
export function createComment(db: Transaction, input: CommentFactoryInput): Promise<Comment> {
  const kind = input.kind ?? 'public';
  return db.comment.create({
    data: {
      body: faker.lorem.sentence(),
      ...input,
      kind,
      audience: kind === 'internal' ? null : (input.audience ?? 'only_me'),
    },
  });
}
