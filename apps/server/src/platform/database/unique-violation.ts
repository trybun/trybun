import { Prisma } from '../../generated/prisma/client.js';

/**
 * Whether a write failed on a unique constraint (Prisma `P2002`): a duplicate that only the
 * index caught, e.g. two concurrent creations with one key, which the service answers with the
 * error code of its rule instead of a `500`. With `index`, only a violation of that unique index
 * counts, for a model with several unique rules.
 */
export function isUniqueViolation(error: unknown, index?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  return index === undefined || violatedIndex(error.meta) === index;
}

/** The index the driver adapter reports in `meta.driverAdapterError.cause.constraint.index`. */
function violatedIndex(meta: Record<string, unknown> | undefined): string | undefined {
  const cause = (meta?.driverAdapterError as { cause?: { constraint?: { index?: unknown } } })
    ?.cause;
  const index = cause?.constraint?.index;
  return typeof index === 'string' ? index : undefined;
}
