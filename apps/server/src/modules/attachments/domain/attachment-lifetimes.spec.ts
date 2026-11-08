import { describe, expect, it } from 'vitest';
import {
  type AttachmentObject,
  draftPurgeCutoff,
  expiredOrphanObjects,
  lostScanAction,
  lostScanCutoff,
} from './attachment-lifetimes.js';

const NOW = new Date('2026-11-06T12:00:00.000Z');
const MINUTE_MS = 60 * 1_000;
const HOUR_MS = 60 * MINUTE_MS;

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

describe('lost scans (Q10)', () => {
  it('are rows unchanged for 15 minutes', () => {
    expect(lostScanCutoff(NOW)).toEqual(ago(15 * MINUTE_MS));
  });

  it.each([
    ['an upload of 20 minutes ago', ago(20 * MINUTE_MS), 'rescan'],
    ['an upload just under 24 hours ago', ago(24 * HOUR_MS - 1), 'rescan'],
    ['an upload of 24 hours ago', ago(24 * HOUR_MS), 'reject'],
    ['an upload of two days ago', ago(48 * HOUR_MS), 'reject'],
  ])('%s is %s', (_, uploadedAt, action) => {
    expect(lostScanAction(uploadedAt, NOW)).toBe(action);
  });
});

describe('purge (ADR 0008, Q21)', () => {
  it('purges drafts uploaded more than 24 hours ago', () => {
    expect(draftPurgeCutoff(NOW)).toEqual(ago(24 * HOUR_MS));
  });

  it('deletes objects without a row written more than 24 hours ago', () => {
    const object = (attachmentId: string, lastModified: Date): AttachmentObject => ({
      key: `available/${attachmentId}`,
      attachmentId,
      lastModified,
    });
    const oldOrphan = object('old-orphan', ago(25 * HOUR_MS));
    const recentOrphan = object('recent-orphan', ago(23 * HOUR_MS));
    const atTheLimit = object('at-the-limit', ago(24 * HOUR_MS));
    const oldWithRow = object('old-with-row', ago(48 * HOUR_MS));

    expect(
      expiredOrphanObjects(
        [oldOrphan, recentOrphan, atTheLimit, oldWithRow],
        new Set(['old-with-row']),
        NOW,
      ),
    ).toEqual([oldOrphan]);
  });
});
