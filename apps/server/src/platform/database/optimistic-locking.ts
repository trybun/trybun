import { AppError } from '../errors/app-error.js';

/** A versioned record as a change addresses it: its ID and the version from `If-Match` (§17.2). */
export interface VersionedTarget {
  id: string;
  version: number;
}

/** The condition of a conditional update or delete: the record in the expected version. */
export function versionedWhere(target: VersionedTarget): VersionedTarget {
  return { id: target.id, version: target.version };
}

/**
 * The arguments of the one conditional update of a versioned record (§18.3): it matches only the
 * expected version and increments it. Used as `tx.<model>.updateMany(versionedUpdate(target,
 * data))`, followed by `assertVersionMatched`; a delete uses
 * `deleteMany({ where: versionedWhere(target) })`.
 */
export function versionedUpdate<Data extends object>(target: VersionedTarget, data: Data) {
  return {
    where: versionedWhere(target),
    data: { ...data, version: { increment: 1 } },
  };
}

/**
 * `412` when the conditional update or delete of a versioned record changed no row: the record was
 * changed by someone else since the version was read (§17.2).
 */
export function assertVersionMatched(result: { count: number }): void {
  if (result.count === 0) {
    throw new AppError('request.precondition_failed');
  }
}
