import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { PURGE_ATTACHMENTS_QUEUE, RECOVER_ATTACHMENT_SCANS_QUEUE } from './attachments.jobs.js';
import { AttachmentsWorkerModule } from './attachments-worker.module.js';

describe('AttachmentsWorkerModule', () => {
  it('schedules the recovery every 5 minutes and the purge hourly (ADR 0008, Q10)', async () => {
    const scheduleRecovery = vi.fn().mockResolvedValue(undefined);
    const schedulePurge = vi.fn().mockResolvedValue(undefined);

    await new AttachmentsWorkerModule(
      { upsertJobScheduler: scheduleRecovery } as unknown as Queue,
      { upsertJobScheduler: schedulePurge } as unknown as Queue,
    ).onApplicationBootstrap();

    expect(scheduleRecovery).toHaveBeenCalledWith(
      RECOVER_ATTACHMENT_SCANS_QUEUE,
      { every: 5 * 60 * 1_000 },
      { name: RECOVER_ATTACHMENT_SCANS_QUEUE },
    );
    expect(schedulePurge).toHaveBeenCalledWith(
      PURGE_ATTACHMENTS_QUEUE,
      { every: 60 * 60 * 1_000 },
      { name: PURGE_ATTACHMENTS_QUEUE },
    );
  });
});
