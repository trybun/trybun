// The Worker jobs that unassign the open tickets of a deactivated or removed team member (§7.4).
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createProjectMember } from '../../../test/factories/project-member.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createTicket } from '../../../test/factories/ticket.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { integrationConfig } from '../../../test/setup/config.js';
import type { Project, User } from '../../generated/prisma/client.js';
import { ConfigModule } from '../../platform/config/config.module.js';
import { DatabaseModule } from '../../platform/database/database.module.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { LoggingModule } from '../../platform/logging/logging.module.js';
import { ActivityEventsModule } from '../activity-events/activity-events.module.js';
import { PROJECT_MEMBER_REMOVED } from '../projects/projects.events.js';
import { USER_DEACTIVATED } from '../users/users.events.js';
import { TicketUnassignmentService } from './ticket-unassignment.service.js';
import {
  UnassignDeactivatedUserProcessor,
  UnassignRemovedMemberProcessor,
} from './tickets.processor.js';

describe('the unassignment of deactivated and removed team members', () => {
  let prisma: PrismaService;
  let deactivated: UnassignDeactivatedUserProcessor;
  let removed: UnassignRemovedMemberProcessor;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(integrationConfig()),
        LoggingModule.forRoot(),
        DatabaseModule,
        ActivityEventsModule,
      ],
      providers: [
        TicketUnassignmentService,
        UnassignDeactivatedUserProcessor,
        UnassignRemovedMemberProcessor,
      ],
    }).compile();
    const app = await moduleRef.init();
    prisma = app.get(PrismaService);
    deactivated = app.get(UnassignDeactivatedUserProcessor);
    removed = app.get(UnassignRemovedMemberProcessor);
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  function job(type: string, payload: Record<string, string>) {
    return { id: randomUUID(), name: type, data: { payload, requestId: null } } as Job;
  }

  const runDeactivation = (user: User) =>
    deactivated.process(job(USER_DEACTIVATED, { userId: user.id }));
  const runRemoval = (project: Project, user: User) =>
    removed.process(job(PROJECT_MEMBER_REMOVED, { projectId: project.id, userId: user.id }));

  /** A team member of the projects, with a ticket in each status given, assigned to them. */
  async function assignedMember(projects: Project[]) {
    const member = await createUser(prisma, { kind: 'team', displayName: 'Ewa Nowak' });
    const requester = await createUser(prisma, { kind: 'team' });
    for (const project of projects) {
      await createProjectMember(prisma, { projectId: project.id, userId: member.id });
    }
    return { member, requester };
  }

  async function assigneeOf(ticketId: string) {
    return (await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).assigneeId;
  }

  it('unassigns the open tickets of a deactivated member in every project, with an automatic event', async () => {
    const projects = [
      await createProject(prisma),
      await createProject(prisma),
      await createProject(prisma, { state: 'archived' }),
    ];
    const { member, requester } = await assignedMember(projects);
    const open = [];
    for (const project of projects) {
      open.push(
        await createTicket(prisma, {
          projectId: project.id,
          requesterId: requester.id,
          assigneeId: member.id,
          status: 'in_progress',
        }),
      );
    }
    const done = await createTicket(prisma, {
      projectId: projects[0]?.id ?? '',
      requesterId: requester.id,
      assigneeId: member.id,
      status: 'done',
    });
    // Edited between the deactivation and the job: the job still finds it.
    await prisma.ticket.update({
      where: { id: open[0]?.id },
      data: { title: 'Edited meanwhile', version: { increment: 1 } },
    });
    await prisma.user.update({ where: { id: member.id }, data: { state: 'deactivated' } });

    await runDeactivation(member);
    await runDeactivation(member);

    for (const ticket of open) {
      expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({
        assigneeId: null,
        version: ticket.id === open[0]?.id ? 3 : 2,
      });
      expect(
        await prisma.activityEvent.findMany({
          where: { ticketId: ticket.id },
          select: { type: true, data: true, actorId: true, automaticSource: true, isPublic: true },
        }),
      ).toEqual([
        {
          type: 'assignee_changed',
          data: { from: { id: member.id, displayName: 'Ewa Nowak' }, to: null },
          actorId: null,
          automaticSource: 'system',
          isPublic: false,
        },
      ]);
    }
    expect(await assigneeOf(done.id)).toBe(member.id);
  });

  it('keeps the tickets of a person reactivated before the job runs', async () => {
    const project = await createProject(prisma);
    const { member, requester } = await assignedMember([project]);
    const ticket = await createTicket(prisma, {
      projectId: project.id,
      requesterId: requester.id,
      assigneeId: member.id,
    });

    await runDeactivation(member);

    expect(await assigneeOf(ticket.id)).toBe(member.id);
    expect(await prisma.activityEvent.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it('unassigns more open tickets than one batch holds', async () => {
    const project = await createProject(prisma);
    const { member, requester } = await assignedMember([project]);
    for (let index = 0; index < 105; index += 1) {
      await createTicket(prisma, {
        projectId: project.id,
        requesterId: requester.id,
        assigneeId: member.id,
      });
    }
    await prisma.user.update({ where: { id: member.id }, data: { state: 'deactivated' } });

    await runDeactivation(member);

    expect(await prisma.ticket.count({ where: { assigneeId: member.id } })).toBe(0);
    expect(await prisma.activityEvent.count({ where: { ticket: { projectId: project.id } } })).toBe(
      105,
    );
  });

  it("unassigns a removed member's open tickets of that project only", async () => {
    const project = await createProject(prisma);
    const otherProject = await createProject(prisma);
    const { member, requester } = await assignedMember([project, otherProject]);
    const ticket = await createTicket(prisma, {
      projectId: project.id,
      requesterId: requester.id,
      assigneeId: member.id,
    });
    const elsewhere = await createTicket(prisma, {
      projectId: otherProject.id,
      requesterId: requester.id,
      assigneeId: member.id,
    });
    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: project.id, userId: member.id } },
    });

    await runRemoval(project, member);

    expect(await assigneeOf(ticket.id)).toBeNull();
    expect(await assigneeOf(elsewhere.id)).toBe(member.id);
  });

  it('keeps the tickets of a member added back before the job runs', async () => {
    const project = await createProject(prisma);
    const { member, requester } = await assignedMember([project]);
    const ticket = await createTicket(prisma, {
      projectId: project.id,
      requesterId: requester.id,
      assigneeId: member.id,
    });

    await runRemoval(project, member);

    expect(await assigneeOf(ticket.id)).toBe(member.id);
  });
});
