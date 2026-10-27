import { Prisma } from '../../generated/prisma/client.js';

/**
 * Whether a write failed on a unique constraint (Prisma `P2002`): a duplicate that only the
 * index caught, e.g. two concurrent creations with one key, which the service answers with the
 * error code of its rule instead of a `500`.
 */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
