import { Prisma } from '../../generated/prisma/client.js';
import { violatedIndex } from './unique-violation.js';

/**
 * Whether a write failed on a foreign key (Prisma `P2003`), e.g. the deletion of a record that a
 * restricting foreign key still references, which the service answers with the error code of its
 * rule instead of a `500` (§18.3). With `constraint`, only a violation of that foreign key counts.
 */
export function isForeignKeyViolation(error: unknown, constraint?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2003') {
    return false;
  }
  return constraint === undefined || violatedIndex(error.meta) === constraint;
}
