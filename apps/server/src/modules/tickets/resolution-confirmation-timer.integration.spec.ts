// The Worker side of the resolution confirmation (§4.3): the consumer of status changes that
// schedules the automatic close, the timer that closes an unconfirmed ticket after 7 days, and a
// reopen that races the removal of its assignee (Q22).
import { randomUUID } from 'node:crypto';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { DelayedError, type Job, Queue } from 'bullmq';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { createProjectMember } from '../../../test/factories/project-member.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createTicket } from '../../../test/factories/ticket.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { ABILITY_DEFINITIONS } from '../../ability-definitions.js';
import type { Project, User } from '../../generated/prisma/client.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AuthorizationModule } from '../../platform/authorization/authorization.module.js';
import { Clock } from '../../platform/clock/clock.js';
import { ClockModule } from '../../platform/clock/clock.module.js';
import { ConfigModule } from '../../platform/config/config.module.js';
import { DatabaseModule } from '../../platform/database/database.module.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { LoggingModule } from '../../platform/logging/logging.module.js';
import { OutboxModule } from '../../platform/outbox/outbox.module.js';
import { ActivityEventsModule } from '../activity-events/activity-events.module.js';
import { AuditLogEntriesModule } from '../audit-log-entries/audit-log-entries.module.js';
import { AttachmentLinksModule } from '../attachments/attachment-links.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import { UsersModule } from '../users/users.module.js';
import { RESOLUTION_CONFIRMATION_PERIOD_MS } from './domain/status-transitions.js';
import { TicketUnassignmentService } from './ticket-unassignment.service.js';
import { TICKET_STATUS_CHANGED } from './tickets.events.js';
import {
  CLOSE_UNCONFIRMED_RESOLUTION_QUEUE,
  resolutionConfirmationTimerKey,
} from './tickets.jobs.js';
import {
  CloseUnconfirmedResolutionProcessor,
  ScheduleResolutionConfirmationCloseProcessor,
  UnassignRemovedMemberProcessor,
} from './tickets.processor.js';
import { ARCHIVED_PROJECT_RECHECK_MS, TicketsService } from './tickets.service.js';

const NOW = new Date('2026-11-05T10:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

class FixedClock extends Clock {
  now(): Date {
    return NOW;
  }
}

describe('the automatic close of an unconfirmed resolution', () => {
  let prisma: PrismaService;
  let tickets: TicketsService;
  let projects: ProjectsService;
  let schedule: ScheduleResolutionConfirmationCloseProcessor;
  let close: CloseUnconfirmedResolutionProcessor;
  let removed: UnassignRemovedMemberProcessor;
  let timers: Queue;
  let closeApp: () => Promise<void>;

  beforeAll(async () => {
    timers = new Queue(`close-unconfirmed-resolution-test-${randomUUID()}`, {
      connection: { url: inject('valkeyUrl') },
    });
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(integrationConfig()),
        LoggingModule.forRoot(),
        ClockModule,
        DatabaseModule,
        AuthorizationModule.forRoot(ABILITY_DEFINITIONS),
        ActivityEventsModule,
        AuditLogEntriesModule,
        AttachmentLinksModule,
        OrganizationsModule,
        OutboxModule,
        ProjectsModule,
        UsersModule,
      ],
      providers: [
        TicketsService,
        TicketUnassignmentService,
        ScheduleResolutionConfirmationCloseProcessor,
        CloseUnconfirmedResolutionProcessor,
        UnassignRemovedMemberProcessor,
        { provide: getQueueToken(CLOSE_UNCONFIRMED_RESOLUTION_QUEUE), useValue: timers },
      ],
    })
      .overrideProvider(Clock)
      .useClass(FixedClock)
      .compile();
    const app = await moduleRef.init();
    prisma = app.get(PrismaService);
    tickets = app.get(TicketsService);
    projects = app.get(ProjectsService);
    schedule = app.get(ScheduleResolutionConfirmationCloseProcessor);
    close = app.get(CloseUnconfirmedResolutionProcessor);
    removed = app.get(UnassignRemovedMemberProcessor);
    closeApp = () => app.close();
  });

  afterAll(async () => {
    await closeApp();
    await timers.obliterate({ force: true });
    await timers.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** A ticket of an end user that waits for the confirmation of its resolution. */
  async function waitingTicket(options: { waitingSince: Date; project?: Project }) {
    const project = options.project ?? (await createProject(prisma, { confirmResolution: true }));
    const requester = await createUser(prisma, { kind: 'end_user' });
    const ticket = await createTicket(prisma, {
      projectId: project.id,
      requesterId: requester.id,
      source: 'user',
      status: 'waiting_for_requester',
      waitingReason: 'confirmation',
      statusBeforeWaiting: 'in_verification',
      waitingSince: options.waitingSince,
    });
    return { project, ticket };
  }

  function timerJob(ticketId: string) {
    return {
      id: randomUUID(),
      data: { ticketId },
      moveToDelayed: vi.fn(() => Promise.resolve()),
    };
  }

  function runTimer(job: ReturnType<typeof timerJob>) {
    return close.process(job as unknown as Job, 'token');
  }

  function statusChangedJob(ticketId: string, projectId: string, waitingReason: string | null) {
    return {
      id: randomUUID(),
      data: {
        payload: {
          ticketId,
          projectId,
          from: 'in_verification',
          to: 'waiting_for_requester',
          fromPublic: 'in_progress',
          toPublic: 'awaiting_reply',
          waitingReason,
          reopen: false,
          actorId: null,
        },
        requestId: null,
      },
    } as unknown as Job;
  }

  describe('scheduling', () => {
    it('adds a timer 7 × 24 hours after the wait started, keyed by the ticket', async () => {
      const waitingSince = new Date(NOW.getTime() - 2 * DAY_MS);
      const { project, ticket } = await waitingTicket({ waitingSince });

      await schedule.process(statusChangedJob(ticket.id, project.id, 'confirmation'));

      const [timer] = (await timers.getDelayed()).filter(
        (job) => (job.data as { ticketId: string }).ticketId === ticket.id,
      );
      expect(timer?.name).toBe(CLOSE_UNCONFIRMED_RESOLUTION_QUEUE);
      expect(timer?.data).toEqual({ ticketId: ticket.id });
      expect(timer?.opts.delay).toBe(RESOLUTION_CONFIRMATION_PERIOD_MS - 2 * DAY_MS);
      expect(timer?.opts.deduplication).toMatchObject({
        id: resolutionConfirmationTimerKey(ticket.id),
        replace: true,
        extend: true,
      });
      expect(resolutionConfirmationTimerKey(ticket.id)).toBe(
        `resolution-confirmation-${ticket.id}`,
      );
    });

    it('adds no timer for a wait for information or a ticket that no longer waits', async () => {
      const { project, ticket } = await waitingTicket({ waitingSince: NOW });
      const answered = await createTicket(prisma, {
        projectId: project.id,
        requesterId: ticket.requesterId,
        source: 'user',
        status: 'in_progress',
      });

      await schedule.process(statusChangedJob(ticket.id, project.id, 'information'));
      await schedule.process(statusChangedJob(answered.id, project.id, 'confirmation'));

      const delayed = await timers.getDelayed();
      expect(
        delayed.filter((job) =>
          [ticket.id, answered.id].includes((job.data as { ticketId: string }).ticketId),
        ),
      ).toEqual([]);
    });
  });

  describe('closing', () => {
    it('closes a ticket without an answer in 7 days with an automatic public event', async () => {
      const { project, ticket } = await waitingTicket({
        waitingSince: new Date(NOW.getTime() - RESOLUTION_CONFIRMATION_PERIOD_MS),
      });

      await runTimer(timerJob(ticket.id));

      expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({
        status: 'done',
        waitingReason: null,
        closedAt: NOW,
        version: ticket.version + 1,
      });
      expect(
        await prisma.activityEvent.findMany({
          where: { ticketId: ticket.id },
          select: { type: true, data: true, actorId: true, automaticSource: true, isPublic: true },
        }),
      ).toEqual([
        {
          type: 'status_changed',
          data: {
            from: 'waiting_for_requester',
            to: 'done',
            reopen: false,
            waitingReason: null,
            duplicateOf: null,
          },
          actorId: null,
          automaticSource: 'system',
          isPublic: true,
        },
      ]);
      const outbox = await prisma.outboxEvent.findMany({
        where: { type: TICKET_STATUS_CHANGED },
        select: { payload: true },
      });
      expect(outbox.map(({ payload }) => payload)).toContainEqual(
        expect.objectContaining({ ticketId: ticket.id, projectId: project.id, actorId: null }),
      );
    });

    it('does nothing for a ticket answered before the timer', async () => {
      const { ticket } = await waitingTicket({
        waitingSince: new Date(NOW.getTime() - 8 * DAY_MS),
      });
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'in_progress',
          waitingReason: null,
          statusBeforeWaiting: null,
          waitingSince: null,
        },
      });

      await runTimer(timerJob(ticket.id));

      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe(
        'in_progress',
      );
    });

    it('waits until 7 days have passed since the confirmation was asked (again)', async () => {
      const waitingSince = new Date(NOW.getTime() - DAY_MS);
      const { ticket } = await waitingTicket({ waitingSince });
      const job = timerJob(ticket.id);

      // A timer that runs early – the Worker's clock behind the one that scheduled it – waits.
      await expect(runTimer(job)).rejects.toBeInstanceOf(DelayedError);

      expect(job.moveToDelayed).toHaveBeenCalledWith(
        waitingSince.getTime() + RESOLUTION_CONFIRMATION_PERIOD_MS,
        'token',
      );
      expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({
        status: 'waiting_for_requester',
        version: ticket.version,
      });
    });

    it('completes without a change for a ticket that is gone', async () => {
      const job = timerJob(randomUUID());

      await expect(runTimer(job)).resolves.toBeUndefined();
      expect(job.moveToDelayed).not.toHaveBeenCalled();
    });

    it('waits 24 hours in an archived project, the same job without a change (Q19)', async () => {
      const { project, ticket } = await waitingTicket({
        waitingSince: new Date(NOW.getTime() - 8 * DAY_MS),
      });
      await prisma.project.update({ where: { id: project.id }, data: { state: 'archived' } });
      const job = timerJob(ticket.id);

      await expect(runTimer(job)).rejects.toBeInstanceOf(DelayedError);

      expect(job.moveToDelayed).toHaveBeenCalledWith(
        NOW.getTime() + ARCHIVED_PROJECT_RECHECK_MS,
        'token',
      );
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe(
        'waiting_for_requester',
      );
    });

    it('waits when the project is archived while the timer waits for the project lock', async () => {
      const { project, ticket } = await waitingTicket({
        waitingSince: new Date(NOW.getTime() - 8 * DAY_MS),
      });
      const job = timerJob(ticket.id);

      let run: Promise<unknown> | undefined;
      await prisma.$transaction(
        async (tx) => {
          await tx.project.update({
            where: { id: project.id },
            data: { state: 'archived', version: { increment: 1 } },
          });
          run = runTimer(job).catch((error: unknown) => error);
          await vi.waitFor(
            async () => {
              const [waiting] = await prisma.$queryRaw<[{ count: bigint }]>`
                SELECT count(*) FROM pg_stat_activity
                WHERE datname = current_database() AND pid <> pg_backend_pid()
                  AND wait_event_type = 'Lock' AND query LIKE '%FOR SHARE%'`;
              expect(waiting.count).toBeGreaterThanOrEqual(1n);
            },
            { timeout: 5000, interval: 20 },
          );
        },
        { timeout: 10_000 },
      );

      expect(await run).toBeInstanceOf(DelayedError);
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe(
        'waiting_for_requester',
      );
    });
  });

  describe('a reopen racing the removal of its assignee (Q22)', () => {
    it('unassigns the reopened ticket when the removal waits for the reopen', async () => {
      const project = await createProject(prisma);
      const actor = await createUser(prisma, { kind: 'team' });
      const assignee: User = await createUser(prisma, { kind: 'team' });
      for (const user of [actor, assignee]) {
        await createProjectMember(prisma, {
          projectId: project.id,
          userId: user.id,
          role: 'developer',
        });
      }
      const ticket = await createTicket(prisma, {
        projectId: project.id,
        requesterId: actor.id,
        status: 'done',
        assigneeId: assignee.id,
      });
      const principal: UserPrincipal = {
        kind: 'user',
        userId: actor.id,
        userKind: 'team',
        isAdmin: false,
      };
      // Once the reopen holds the share lock of the membership, the removal starts on another
      // connection and has to wait for it.
      let removal: Promise<unknown> | undefined;
      const lockMember = projects.lockMemberForShare.bind(projects);
      vi.spyOn(projects, 'lockMemberForShare').mockImplementation(async (tx, projectId, userId) => {
        const isLocked = await lockMember(tx, projectId, userId);
        if (userId === assignee.id && removal === undefined) {
          // Prisma runs a query only once it is awaited or `then` is called.
          removal = prisma.projectMember
            .delete({
              where: { projectId_userId: { projectId: project.id, userId: assignee.id } },
            })
            .then((row) => row);
          await vi.waitFor(
            async () => {
              const [waiting] = await prisma.$queryRaw<[{ count: bigint }]>`
                SELECT count(*) FROM pg_stat_activity
                WHERE datname = current_database() AND pid <> pg_backend_pid()
                  AND wait_event_type = 'Lock' AND query LIKE '%DELETE%project_members%'`;
              expect(waiting.count).toBeGreaterThanOrEqual(1n);
            },
            { timeout: 5000, interval: 20 },
          );
        }
        return isLocked;
      });

      const reopened = await tickets.changeStatus(
        principal,
        { id: ticket.id, version: ticket.version },
        { status: 'in_progress' },
      );
      await removal;
      vi.restoreAllMocks();
      await removed.process({
        id: randomUUID(),
        data: { payload: { projectId: project.id, userId: assignee.id }, requestId: null },
      } as unknown as Job);

      expect(reopened).toMatchObject({ status: 'in_progress', assignee: { id: assignee.id } });
      expect(
        (await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).assigneeId,
      ).toBeNull();
    });
  });
});
