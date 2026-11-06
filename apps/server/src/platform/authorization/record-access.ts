import type { ErrorCode } from '@trybun/contracts/errors';
import type { Principal } from '../authentication/principal.js';

/** A record addressed by the path of a request and the action the handler performs on it. */
export interface TargetRecord {
  /** The Prisma model name of the record (§18.3). */
  subject: string;
  id: string;
  /** An action code of the subject (§18.3), e.g. `read`, `update`. */
  action: string;
}

/**
 * The outcome for a target record: `not_found` for a record that does not exist or that the
 * principal may not see (`404`, §17.2); `denied` for a visible record on which the action is not
 * permitted, with `request.forbidden` or the code of the denying rule (§18.3).
 */
export type RecordAccessDecision =
  { outcome: 'allowed' } | { outcome: 'not_found' } | { outcome: 'denied'; code: ErrorCode };

/**
 * Looks up a target record through the principal's ability (§18.3): the implementation of the
 * request pipeline is `PrismaRecordAccess`; tests of the pipeline replace it.
 */
export abstract class RecordAccess {
  abstract decide(principal: Principal, target: TargetRecord): Promise<RecordAccessDecision>;
}
