import { describe, expect, it } from 'vitest';
import {
  draftUsageOf,
  exceedsDraftQuota,
  isDraftQuotaFull,
  MAX_DRAFT_BYTES,
  remainingDraftBytes,
} from './draft-quota.js';

const MB = 1024 * 1024;

describe('draft quota (§13.3, Q23)', () => {
  it('counts drafts in every status and only the bytes of stored ones', () => {
    expect(
      draftUsageOf([
        { status: 'quarantine', count: 2, bytes: 3 * MB },
        { status: 'available', count: 1, bytes: MB },
        { status: 'infected', count: 4, bytes: 7 * MB },
        { status: 'rejected', count: 1, bytes: MB },
      ]),
    ).toEqual({ count: 8, bytes: 4 * MB });
  });

  it.each([
    [{ count: 49, bytes: 0 }, false],
    [{ count: 50, bytes: 0 }, true],
  ])('is full for %o: %s', (usage, isFull) => {
    expect(isDraftQuotaFull(usage)).toBe(isFull);
  });

  it.each([
    [{ count: 1, bytes: 10 * MB }, 240 * MB],
    [{ count: 1, bytes: MAX_DRAFT_BYTES + 1 }, 0],
  ])('leaves for %o %i bytes', (usage, remaining) => {
    expect(remainingDraftBytes(usage)).toBe(remaining);
  });

  it.each([
    ['the 50th draft', { count: 49, bytes: 0 }, { count: 1, bytes: MB }, false],
    ['the 51st draft', { count: 49, bytes: 0 }, { count: 2, bytes: MB }, true],
    ['exactly 250 MB', { count: 1, bytes: 200 * MB }, { count: 2, bytes: 50 * MB }, false],
    [
      'one byte more than 250 MB',
      { count: 1, bytes: 200 * MB },
      { count: 1, bytes: 50 * MB + 1 },
      true,
    ],
  ])('%s exceeds it: %s', (_case, usage, added, isExceeded) => {
    expect(exceedsDraftQuota(usage, added)).toBe(isExceeded);
  });
});
