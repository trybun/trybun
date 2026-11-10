import type { Prisma } from '../../generated/prisma/client.js';

/**
 * The condition of a text column containing the search text of a list (`query`, §12.1), ignoring
 * case and taken literally. Prisma passes `contains` to `ILIKE` without escaping its wildcards, so
 * `_`, `%` and the escape character `\` are escaped here: `a_b` never matches `axb`.
 */
export function containsText(search: string): Prisma.StringFilter {
  return { contains: search.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' };
}
