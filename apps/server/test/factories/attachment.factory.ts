import { faker } from '@faker-js/faker';
import type { Attachment, Prisma } from '../../src/generated/prisma/client.js';
import type { Transaction } from '../../src/platform/database/prisma.service.js';
import { newId } from '../../src/platform/database/ids.js';

export type AttachmentFactoryInput = Omit<
  Prisma.AttachmentUncheckedCreateInput,
  'id' | 'fileName' | 'contentType' | 'size'
> &
  Partial<Pick<Prisma.AttachmentUncheckedCreateInput, 'id' | 'fileName' | 'contentType' | 'size'>>;

/**
 * An attachment row without an object in the storage: a draft in quarantine unless the overrides
 * link it to a ticket or give it another status.
 */
export function createAttachment(
  db: Transaction,
  input: AttachmentFactoryInput,
): Promise<Attachment> {
  return db.attachment.create({
    data: {
      id: newId(),
      fileName: faker.system.commonFileName('txt'),
      contentType: 'text/plain; charset=utf-8',
      size: faker.number.int({ min: 1, max: 100_000 }),
      ...input,
    },
  });
}
