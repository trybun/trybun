import { AppError } from '../errors/app-error.js';

/**
 * `422 field.unrecognized` for the query parameters only team accounts may send, in an end user's
 * request (§8.1, S1-13 Q21): the ticket filters and sorts, the search and lookup of the project
 * list. Each sent parameter is named at its pointer.
 */
export function assertNoTeamParameters<Query extends object>(
  query: Query,
  keys: readonly (keyof Query & string)[],
): void {
  const sent = keys.filter((key) => query[key] !== undefined);
  if (sent.length > 0) {
    throw new AppError(
      'request.validation_failed',
      sent.map((key) => ({ pointer: `/${key}`, code: 'field.unrecognized' })),
    );
  }
}
