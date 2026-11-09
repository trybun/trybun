import { v7 } from 'uuid';

/**
 * A new UUIDv7 (§17.2), the one ID function for code that needs an ID before the insert (§18.3),
 * e.g. an attachment, whose ID is the key of its object in the storage (ADR 0008). Records without
 * that need get theirs from the default of the Prisma schema.
 */
export function newId(): string {
  return v7();
}
