import type { AttachmentStatus } from '@trybun/contracts/attachments';
import { AppError } from '../../../platform/errors/app-error.js';

/** The drafts one user may hold at a time (§13.3, Q23). */
export const MAX_DRAFTS = 50;

/** The stored bytes of the drafts one user may hold at a time (§13.3, Q23). */
export const MAX_DRAFT_BYTES = 250 * 1024 * 1024;

/** Infected and rejected files are deleted from the storage, so only these count as bytes. */
const STORED_STATUSES: ReadonlySet<AttachmentStatus> = new Set(['quarantine', 'available']);

/** The drafts of a user: their number in every status and the bytes of the stored ones. */
export interface DraftUsage {
  count: number;
  bytes: number;
}

/** The usage of a user's drafts from their number and size per status. */
export function draftUsageOf(
  groups: readonly { status: AttachmentStatus; count: number; bytes: number }[],
): DraftUsage {
  return groups.reduce(
    (usage, group) => ({
      count: usage.count + group.count,
      bytes: usage.bytes + (STORED_STATUSES.has(group.status) ? group.bytes : 0),
    }),
    { count: 0, bytes: 0 },
  );
}

/** Whether a user has no draft left to upload. */
export function isDraftQuotaFull(usage: DraftUsage): boolean {
  return usage.count >= MAX_DRAFTS;
}

/** The bytes a user may still upload as drafts. */
export function remainingDraftBytes(usage: DraftUsage): number {
  return Math.max(0, MAX_DRAFT_BYTES - usage.bytes);
}

/** Whether new drafts would take a user beyond the quota (Q23). */
export function exceedsDraftQuota(usage: DraftUsage, added: DraftUsage): boolean {
  return usage.count + added.count > MAX_DRAFTS || usage.bytes + added.bytes > MAX_DRAFT_BYTES;
}

/** The error of an upload beyond the quota (§13.3), at the pointer of the files (Q11). */
export function draftLimitReached(): AppError {
  return new AppError('attachment.draft_limit_reached', [
    { pointer: '/files', code: 'field.invalid' },
  ]);
}
