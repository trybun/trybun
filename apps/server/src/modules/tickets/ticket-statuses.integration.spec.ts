// The status endpoints of tickets (§4.3): the status change of the team, duplicates, reopen,
// the resolution confirmation of the requester, and the project lock of ticket changes (Q23).
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { EndUserTicket, Ticket } from '@trybun/contracts/tickets';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createProjectMember } from '../../../test/factories/project-member.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createDuplicateRelation, createTicket } from '../../../test/factories/ticket.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { ApiModule } from '../../api.module.js';
import type { Project, Ticket as TicketRow } from '../../generated/prisma/client.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';
import { TICKET_STATUS_CHANGED } from './tickets.events.js';

type Who = 'admin' | 'project_manager' | 'developer' | 'end_user';

describe('ticket status endpoints', () => {
  const config = integrationConfig();
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiModule.forRoot(config)],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    mswServer.use(keycloakJwksHandler(config));
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function signIn(who: Who, project?: Project) {
    const user = await createUser(prisma, {
      keycloakUserId: randomUUID(),
      kind: who === 'end_user' ? 'end_user' : 'team',
      isAdmin: who === 'admin',
    });
    if (project !== undefined && who !== 'admin') {
      await createProjectMember(prisma, { projectId: project.id, userId: user.id, role: who });
    }
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: who === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
    });
    return { user, authorization: `Bearer ${token}` };
  }

  function changeStatus(
    authorization: string,
    ticket: { id: string; version: number },
    body: object,
    options: { ifMatch?: boolean } = {},
  ) {
    const req = http()
      .put(`/api/v1/tickets/${ticket.id}/status`)
      .set('Authorization', authorization);
    return (options.ifMatch === false ? req : req.set('If-Match', `W/"${ticket.version}"`)).send(
      body,
    );
  }

  function answer(authorization: string, ticket: { id: string }, body: object) {
    return http()
      .post(`/api/v1/tickets/${ticket.id}/resolution-confirmation`)
      .set('Authorization', authorization)
      .send(body);
  }

  function read(id: string) {
    return prisma.ticket.findUniqueOrThrow({ where: { id } });
  }

  function events(ticketId: string) {
    return prisma.activityEvent.findMany({
      where: { ticketId },
      select: { type: true, data: true, actorId: true, automaticSource: true, isPublic: true },
      orderBy: { id: 'asc' },
    });
  }

  async function outboxPayloads(ticketId: string) {
    const rows = await prisma.outboxEvent.findMany({
      where: { type: TICKET_STATUS_CHANGED },
      select: { payload: true },
      orderBy: { id: 'asc' },
    });
    return rows
      .map(({ payload }) => payload as Record<string, unknown>)
      .filter((payload) => payload.ticketId === ticketId);
  }

  function originalOf(ticketId: string) {
    return prisma.ticketRelation.findMany({
      where: { kind: 'duplicate_of', sourceTicketId: ticketId },
      select: { targetTicketId: true },
    });
  }

  /** A team setup: a project, a Developer and a ticket of the project. */
  async function setUp(ticket: Partial<Parameters<typeof createTicket>[1]> = {}) {
    const project = await createProject(prisma);
    const developer = await signIn('developer', project);
    const row = await createTicket(prisma, {
      projectId: project.id,
      requesterId: developer.user.id,
      ...ticket,
    });
    return { project, developer, ticket: row };
  }

  /** Commits `change` only once another connection waits for a row lock taken `FOR SHARE`. */
  async function whileWaitingForShareLock(
    change: (tx: Transaction) => Promise<unknown>,
    start: () => unknown,
  ) {
    await prisma.$transaction(
      async (tx) => {
        await change(tx);
        start();
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
  }

  describe('changing the status', () => {
    it('moves a ticket with an event, an outbox event and a new version', async () => {
      const { developer, ticket } = await setUp({ status: 'todo' });

      const res = await changeStatus(developer.authorization, ticket, { status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.headers.etag).toBe('W/"2"');
      expect(res.body).toMatchObject({
        status: 'in_progress',
        publicStatus: 'in_progress',
        version: 2,
        closedAt: null,
      });
      expect(await events(ticket.id)).toEqual([
        {
          type: 'status_changed',
          data: {
            from: 'todo',
            to: 'in_progress',
            reopen: false,
            waitingReason: null,
            duplicateOf: null,
          },
          actorId: developer.user.id,
          automaticSource: null,
          isPublic: false,
        },
      ]);
      expect(await outboxPayloads(ticket.id)).toEqual([
        {
          ticketId: ticket.id,
          projectId: ticket.projectId,
          from: 'todo',
          to: 'in_progress',
          fromPublic: 'in_progress',
          toPublic: 'in_progress',
          waitingReason: null,
          reopen: false,
          actorId: developer.user.id,
        },
      ]);
    });

    it('changes nothing for the current status, after checking the version (Q16)', async () => {
      const { developer, ticket } = await setUp({ status: 'todo' });

      const res = await changeStatus(developer.authorization, ticket, { status: 'todo' });
      const stale = await changeStatus(
        developer.authorization,
        { ...ticket, version: 9 },
        { status: 'todo' },
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ version: 1 });
      expect(stale.status).toBe(412);
      expect(await events(ticket.id)).toEqual([]);
      expect(await outboxPayloads(ticket.id)).toEqual([]);
    });

    it('answers a stale version with 412 and a missing one with 428', async () => {
      const { developer, ticket } = await setUp();

      const stale = await changeStatus(
        developer.authorization,
        { ...ticket, version: 2 },
        { status: 'done' },
      );
      const missing = await changeStatus(
        developer.authorization,
        ticket,
        { status: 'done' },
        { ifMatch: false },
      );

      expect(stale.status).toBe(412);
      expect(missing.status).toBe(428);
      expect((await read(ticket.id)).status).toBe('todo');
    });

    it('answers a Developer of another project with 404', async () => {
      const { ticket } = await setUp();
      const other = await signIn('developer', await createProject(prisma));

      const res = await changeStatus(other.authorization, ticket, { status: 'done' });

      expect(res.status).toBe(404);
    });

    it('answers an end user who sees the ticket with 403 and one who does not with 404', async () => {
      const project = await createProject(prisma);
      const requester = await signIn('end_user', project);
      const stranger = await signIn('end_user', project);
      const ticket = await createTicket(prisma, {
        projectId: project.id,
        requesterId: requester.user.id,
        source: 'user',
        status: 'new',
      });

      const own = await changeStatus(requester.authorization, ticket, { status: 'done' });
      const foreign = await changeStatus(stranger.authorization, ticket, { status: 'done' });

      expect(own.status).toBe(403);
      expect(foreign.status).toBe(404);
    });

    it('answers a ticket of an archived project with 409 project.archived', async () => {
      const { project, developer, ticket } = await setUp();
      await prisma.project.update({ where: { id: project.id }, data: { state: 'archived' } });

      const res = await changeStatus(developer.authorization, ticket, { status: 'done' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'project.archived' });
    });

    it('changes nothing in a project archived while the change waits for it (Q23)', async () => {
      const { project, developer, ticket } = await setUp();

      let change: Promise<request.Response> | undefined;
      await whileWaitingForShareLock(
        (tx) =>
          tx.project.update({
            where: { id: project.id },
            data: { state: 'archived', version: { increment: 1 } },
          }),
        () => {
          change = changeStatus(developer.authorization, ticket, { status: 'done' }).then(
            (res) => res,
          );
        },
      );
      const res = await (change as Promise<request.Response>);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'project.archived' });
      expect((await read(ticket.id)).status).toBe('todo');
    });

    it('makes an archive wait for a status change holding the project lock (Q23)', async () => {
      const { project, developer, ticket } = await setUp();
      const [res] = await Promise.all([
        changeStatus(developer.authorization, ticket, { status: 'done' }),
        // The archive is an update of the row, so it never commits between the lock and the
        // change: whichever order the two take, the ticket of an archived project stays as it is
        // or the change committed before the archive.
        prisma.project.update({
          where: { id: project.id },
          data: { state: 'archived', version: { increment: 1 } },
        }),
      ]);

      const after = await read(ticket.id);
      if (res.status === 200) {
        expect(after.status).toBe('done');
      } else {
        expect(res.status).toBe(409);
        expect(after.status).toBe('todo');
      }
    });
  });

  describe('rejecting', () => {
    it('refuses a rejection without a reason with 422 at /rejectionReason, changing nothing', async () => {
      const { developer, ticket } = await setUp();

      const res = await changeStatus(developer.authorization, ticket, { status: 'rejected' });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        code: 'request.validation_failed',
        errors: [{ pointer: '/rejectionReason', code: 'field.invalid_type' }],
      });
      expect((await read(ticket.id)).status).toBe('todo');
    });

    it('stores the reason for the team only and keeps it out of every event and payload', async () => {
      const project = await createProject(prisma);
      const developer = await signIn('developer', project);
      const requester = await signIn('end_user', project);
      const ticket = await createTicket(prisma, {
        projectId: project.id,
        requesterId: requester.user.id,
        source: 'user',
        status: 'triage',
      });
      const reason = `Out of scope ${randomUUID()}`;

      const res = await changeStatus(developer.authorization, ticket, {
        status: 'rejected',
        rejectionReason: `  ${reason} `,
      });
      const again = await changeStatus(
        developer.authorization,
        { id: ticket.id, version: 2 },
        { status: 'rejected', rejectionReason: `${reason} – duplicate effort` },
      );
      const endUserView = await http()
        .get(`/api/v1/tickets/${ticket.id}`)
        .set('Authorization', requester.authorization);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'rejected',
        publicStatus: 'closed',
        rejectionReason: reason,
        closedAt: expect.any(String) as string,
      });
      expect(again.body).toMatchObject({ rejectionReason: `${reason} – duplicate effort` });
      expect(endUserView.body).toMatchObject({ publicStatus: 'closed' });
      expect(endUserView.body).not.toHaveProperty('rejectionReason');
      expect(endUserView.body).not.toHaveProperty('status');
      expect((await events(ticket.id)).map(({ type, isPublic }) => [type, isPublic])).toEqual([
        ['status_changed', true],
        ['rejection_reason_changed', false],
      ]);
      const stored = JSON.stringify([await events(ticket.id), await outboxPayloads(ticket.id)]);
      expect(stored).not.toContain('Out of scope');
    });
  });

  describe('duplicates', () => {
    async function duplicateSetUp() {
      const { project, developer, ticket } = await setUp();
      const original = await createTicket(prisma, {
        projectId: project.id,
        requesterId: developer.user.id,
      });
      return { project, developer, ticket, original };
    }

    it('links a duplicate to its original with an event and closes it', async () => {
      const { project, developer, ticket, original } = await duplicateSetUp();

      const res = await changeStatus(developer.authorization, ticket, {
        status: 'duplicate',
        duplicateOfTicketId: original.id,
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'duplicate',
        publicStatus: 'closed',
        duplicateOf: { id: original.id, number: original.number, projectKey: project.key },
      });
      expect(await originalOf(ticket.id)).toEqual([{ targetTicketId: original.id }]);
      expect((await events(ticket.id))[0]?.data).toMatchObject({
        to: 'duplicate',
        duplicateOf: { id: original.id, number: original.number, projectKey: project.key },
      });
    });

    it('links a duplicate of a duplicate to the original (§3.5)', async () => {
      const { project, developer, ticket, original } = await duplicateSetUp();
      const middle = await createTicket(prisma, {
        projectId: project.id,
        requesterId: developer.user.id,
        status: 'duplicate',
      });
      await createDuplicateRelation(prisma, middle, original);

      const res = await changeStatus(developer.authorization, ticket, {
        status: 'duplicate',
        duplicateOfTicketId: middle.id,
      });

      expect(res.status).toBe(200);
      expect(await originalOf(ticket.id)).toEqual([{ targetTicketId: original.id }]);
    });

    it('passes the duplicates of a ticket that becomes a duplicate on to its original (Q8)', async () => {
      const { project, developer, ticket, original } = await duplicateSetUp();
      const earlier = await createTicket(prisma, {
        projectId: project.id,
        requesterId: developer.user.id,
        status: 'duplicate',
      });
      await createDuplicateRelation(prisma, earlier, ticket);

      await changeStatus(developer.authorization, ticket, {
        status: 'duplicate',
        duplicateOfTicketId: original.id,
      });

      expect(await originalOf(earlier.id)).toEqual([{ targetTicketId: original.id }]);
      expect(await events(earlier.id)).toEqual([
        {
          type: 'duplicate_original_changed',
          data: {
            from: { id: ticket.id, number: ticket.number, projectKey: project.key },
            to: { id: original.id, number: original.number, projectKey: project.key },
          },
          actorId: null,
          automaticSource: 'system',
          isPublic: false,
        },
      ]);
    });

    it('re-points a duplicate to a new original without a new version (Q16)', async () => {
      const { project, developer, ticket, original } = await duplicateSetUp();
      const other = await createTicket(prisma, {
        projectId: project.id,
        requesterId: developer.user.id,
      });
      const first = await changeStatus(developer.authorization, ticket, {
        status: 'duplicate',
        duplicateOfTicketId: original.id,
      });

      const res = await changeStatus(developer.authorization, first.body as Ticket, {
        status: 'duplicate',
        duplicateOfTicketId: other.id,
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ version: 2, duplicateOf: { id: other.id } });
      expect(await originalOf(ticket.id)).toEqual([{ targetTicketId: other.id }]);
      expect((await events(ticket.id)).map(({ type }) => type)).toEqual([
        'status_changed',
        'duplicate_original_changed',
      ]);
    });

    it('refuses a re-point that read the ticket before a change left duplicate', async () => {
      const { project, developer, ticket, original } = await duplicateSetUp();
      const linked = (
        await changeStatus(developer.authorization, ticket, {
          status: 'duplicate',
          duplicateOfTicketId: original.id,
        })
      ).body as Ticket;
      const other = await createTicket(prisma, {
        projectId: project.id,
        requesterId: developer.user.id,
      });

      let repoint: Promise<request.Response> | undefined;
      await prisma.$transaction(
        async (tx) => {
          // Another change leaves `duplicate` and holds the row until it commits.
          await tx.ticketRelation.deleteMany({ where: { sourceTicketId: ticket.id } });
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { status: 'in_progress', closedAt: null, version: { increment: 1 } },
          });
          repoint = changeStatus(developer.authorization, linked, {
            status: 'duplicate',
            duplicateOfTicketId: other.id,
          }).then((res) => res);
          await vi.waitFor(
            async () => {
              const [waiting] = await prisma.$queryRaw<[{ count: bigint }]>`
                SELECT count(*) FROM pg_stat_activity
                WHERE datname = current_database() AND pid <> pg_backend_pid()
                  AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE%'`;
              expect(waiting.count).toBeGreaterThanOrEqual(1n);
            },
            { timeout: 5000, interval: 20 },
          );
        },
        { timeout: 10_000 },
      );
      const res = await (repoint as Promise<request.Response>);

      expect(res.status).toBe(412);
      expect(await originalOf(ticket.id)).toEqual([]);
      expect((await read(ticket.id)).status).toBe('in_progress');
    });

    it('answers an invisible original with 404, another project with 422 and itself with 422', async () => {
      const { developer, ticket } = await duplicateSetUp();
      const elsewhere = await createProject(prisma);
      const foreign = await createTicket(prisma, {
        projectId: elsewhere.id,
        requesterId: developer.user.id,
      });
      const admin = await signIn('admin');

      const invisible = await changeStatus(developer.authorization, ticket, {
        status: 'duplicate',
        duplicateOfTicketId: foreign.id,
      });
      const otherProject = await changeStatus(admin.authorization, ticket, {
        status: 'duplicate',
        duplicateOfTicketId: foreign.id,
      });
      const self = await changeStatus(developer.authorization, ticket, {
        status: 'duplicate',
        duplicateOfTicketId: ticket.id,
      });

      expect(invisible.status).toBe(404);
      expect(otherProject.status).toBe(422);
      expect(otherProject.body).toMatchObject({ code: 'ticket.duplicate_other_project' });
      expect(self.status).toBe(422);
      expect(self.body).toMatchObject({ code: 'ticket.duplicate_of_self' });
      expect((await read(ticket.id)).status).toBe('todo');
    });

    it('answers a link back through a duplicate of the ticket with 422 duplicate_of_self', async () => {
      const { project, developer, ticket } = await duplicateSetUp();
      const copy = await createTicket(prisma, {
        projectId: project.id,
        requesterId: developer.user.id,
        status: 'duplicate',
      });
      await createDuplicateRelation(prisma, copy, ticket);

      const res = await changeStatus(developer.authorization, ticket, {
        status: 'duplicate',
        duplicateOfTicketId: copy.id,
      });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'ticket.duplicate_of_self' });
    });

    it('leaves no cycle after two concurrent opposite duplicate requests', async () => {
      const { developer, ticket: first, original: second } = await duplicateSetUp();

      const responses = await Promise.all([
        changeStatus(developer.authorization, first, {
          status: 'duplicate',
          duplicateOfTicketId: second.id,
        }),
        changeStatus(developer.authorization, second, {
          status: 'duplicate',
          duplicateOfTicketId: first.id,
        }),
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([200, 422]);
      const relations = await prisma.ticketRelation.findMany({
        where: { sourceTicketId: { in: [first.id, second.id] } },
      });
      expect(relations).toHaveLength(1);
    });

    it('removes the link of a reopened duplicate with an event and clears the closing time', async () => {
      const { project, developer, ticket, original } = await duplicateSetUp();
      const linked = await changeStatus(developer.authorization, ticket, {
        status: 'duplicate',
        duplicateOfTicketId: original.id,
      });

      const res = await changeStatus(developer.authorization, linked.body as Ticket, {
        status: 'triage',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'triage', duplicateOf: null, closedAt: null });
      expect(await originalOf(ticket.id)).toEqual([]);
      const [, reopened, removed] = await events(ticket.id);
      expect(reopened?.data).toMatchObject({ from: 'duplicate', to: 'triage', reopen: true });
      expect(removed).toMatchObject({
        type: 'duplicate_link_removed',
        data: {
          from: { id: original.id, number: original.number, projectKey: project.key },
          to: null,
        },
      });
      expect((await outboxPayloads(ticket.id))[1]).toMatchObject({ reopen: true });
    });

    it('shows an end user the original only when they may read it (§3.5)', async () => {
      const project = await createProject(prisma);
      const developer = await signIn('developer', project);
      const requester = await signIn('end_user', project);
      const ownOriginal = await createTicket(prisma, {
        projectId: project.id,
        requesterId: requester.user.id,
        source: 'user',
      });
      const foreignOriginal = await createTicket(prisma, {
        projectId: project.id,
        requesterId: developer.user.id,
      });
      const tickets = await Promise.all(
        [ownOriginal, foreignOriginal].map(() =>
          createTicket(prisma, {
            projectId: project.id,
            requesterId: requester.user.id,
            source: 'user',
            status: 'new',
          }),
        ),
      );
      for (const [index, original] of [ownOriginal, foreignOriginal].entries()) {
        const ticket = tickets[index] as TicketRow;
        await changeStatus(developer.authorization, ticket, {
          status: 'duplicate',
          duplicateOfTicketId: original.id,
        });
      }

      const views = await Promise.all(
        tickets.map((ticket) =>
          http().get(`/api/v1/tickets/${ticket.id}`).set('Authorization', requester.authorization),
        ),
      );

      expect((views[0]?.body as EndUserTicket).duplicateOf).toMatchObject({ id: ownOriginal.id });
      expect((views[1]?.body as EndUserTicket).duplicateOf).toBeNull();
    });
  });

  describe('reopening', () => {
    it('removes an assignee who is no longer an active team member of the project (Q22)', async () => {
      const { project, developer, ticket } = await setUp({ status: 'done' });
      const former = await createUser(prisma, { kind: 'team' });
      await prisma.ticket.update({ where: { id: ticket.id }, data: { assigneeId: former.id } });

      const res = await changeStatus(developer.authorization, ticket, { status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'in_progress', assignee: null, closedAt: null });
      expect(
        (await events(ticket.id)).map(({ type, automaticSource }) => [type, automaticSource]),
      ).toEqual([
        ['assignee_changed', 'system'],
        ['status_changed', null],
      ]);
      expect(await prisma.projectMember.count({ where: { projectId: project.id } })).toBe(1);
    });

    it('keeps an assignee who is still eligible', async () => {
      const { developer, ticket } = await setUp({ status: 'rejected' });
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { assigneeId: developer.user.id },
      });

      const res = await changeStatus(developer.authorization, ticket, { status: 'todo' });

      expect(res.body).toMatchObject({
        assignee: { id: developer.user.id },
        rejectionReason: null,
      });
    });

    it('unassigns a reopened ticket whose assignee is removed while the reopen waits', async () => {
      const { project, developer, ticket } = await setUp({ status: 'done' });
      const assignee = await createUser(prisma, { kind: 'team' });
      await createProjectMember(prisma, {
        projectId: project.id,
        userId: assignee.id,
        role: 'developer',
      });
      await prisma.ticket.update({ where: { id: ticket.id }, data: { assigneeId: assignee.id } });

      let reopen: Promise<request.Response> | undefined;
      await prisma.$transaction(
        async (tx) => {
          await tx.projectMember.delete({
            where: { projectId_userId: { projectId: project.id, userId: assignee.id } },
          });
          reopen = changeStatus(developer.authorization, ticket, { status: 'triage' }).then(
            (res) => res,
          );
          await vi.waitFor(
            async () => {
              const [waiting] = await prisma.$queryRaw<[{ count: bigint }]>`
                SELECT count(*) FROM pg_stat_activity
                WHERE datname = current_database() AND pid <> pg_backend_pid()
                  AND wait_event_type = 'Lock' AND query LIKE '%project_members%FOR SHARE%'`;
              expect(waiting.count).toBeGreaterThanOrEqual(1n);
            },
            { timeout: 5000, interval: 20 },
          );
        },
        { timeout: 10_000 },
      );
      const res = await (reopen as Promise<request.Response>);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'triage', assignee: null });
    });
  });

  describe('resolution confirmation', () => {
    async function confirmationSetUp(options: { confirmResolution?: boolean } = {}) {
      const project = await createProject(prisma, {
        confirmResolution: options.confirmResolution ?? true,
      });
      const developer = await signIn('developer', project);
      const requester = await signIn('end_user', project);
      const ticket = await createTicket(prisma, {
        projectId: project.id,
        requesterId: requester.user.id,
        source: 'user',
        status: 'in_verification',
      });
      return { project, developer, requester, ticket };
    }

    it('asks the requester instead of closing a user ticket, as the response shows', async () => {
      const { developer, requester, ticket } = await confirmationSetUp();

      const res = await changeStatus(developer.authorization, ticket, { status: 'done' });
      const view = await http()
        .get(`/api/v1/tickets/${ticket.id}`)
        .set('Authorization', requester.authorization);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'waiting_for_requester',
        waitingReason: 'confirmation',
        publicStatus: 'awaiting_reply',
        closedAt: null,
      });
      expect(view.body).toMatchObject({
        publicStatus: 'awaiting_reply',
        waitingReason: 'confirmation',
        allowedActions: [
          'read',
          'update',
          'confirm_resolution',
          'add_attachment',
          'set_visibility_all_customers',
        ],
      });
      expect(await read(ticket.id)).toMatchObject({ statusBeforeWaiting: 'in_verification' });
      expect((await outboxPayloads(ticket.id))[0]).toMatchObject({
        to: 'waiting_for_requester',
        waitingReason: 'confirmation',
      });
    });

    it.each([
      ['the setting is off', false, 'user'],
      ['the ticket comes from the team', true, 'developer'],
    ] as const)('closes directly when %s', async (_case, confirmResolution, source) => {
      const { developer, ticket } = await confirmationSetUp({ confirmResolution });
      await prisma.ticket.update({ where: { id: ticket.id }, data: { source } });

      const res = await changeStatus(developer.authorization, ticket, { status: 'done' });

      expect(res.body).toMatchObject({ status: 'done', waitingReason: null });
    });

    it('closes a ticket that waits for confirmation directly when the team moves it to done (Q5)', async () => {
      const { developer, ticket } = await confirmationSetUp();
      const waiting = await changeStatus(developer.authorization, ticket, { status: 'done' });

      const res = await changeStatus(developer.authorization, waiting.body as Ticket, {
        status: 'done',
      });

      expect(res.body).toMatchObject({ status: 'done', closedAt: expect.any(String) as string });
    });

    it.each([
      ['solved', 'done', 'resolved'],
      ['not_solved', 'in_progress', 'in_progress'],
    ] as const)('moves the ticket for the answer %s to %s', async (reply, status, publicStatus) => {
      const { developer, requester, ticket } = await confirmationSetUp();
      await changeStatus(developer.authorization, ticket, { status: 'done' });

      const res = await answer(requester.authorization, ticket, { answer: reply });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        publicStatus,
        allowedActions: ['read', 'update', 'add_attachment', 'set_visibility_all_customers'],
      });
      expect((await read(ticket.id)).status).toBe(status);
      const [, answered] = await events(ticket.id);
      expect(answered).toMatchObject({
        type: 'status_changed',
        actorId: requester.user.id,
        isPublic: true,
        data: { from: 'waiting_for_requester', to: status },
      });
    });

    it('lets only the requester answer, and only while the ticket waits', async () => {
      const { project, developer, requester, ticket } = await confirmationSetUp();
      const stranger = await signIn('end_user', project);
      const manager = await signIn('project_manager', project);
      const before = await answer(requester.authorization, ticket, { answer: 'solved' });
      await changeStatus(developer.authorization, ticket, { status: 'done' });

      const foreign = await answer(stranger.authorization, ticket, { answer: 'solved' });
      const team = await answer(manager.authorization, ticket, { answer: 'solved' });

      expect(before.status).toBe(409);
      expect(before.body).toMatchObject({ code: 'ticket.resolution_confirmation_not_pending' });
      expect(foreign.status).toBe(404);
      expect(team.status).toBe(403);
      expect((await read(ticket.id)).status).toBe('waiting_for_requester');
    });

    it('accepts only the first of two answers started together', async () => {
      const { developer, requester, ticket } = await confirmationSetUp();
      await changeStatus(developer.authorization, ticket, { status: 'done' });

      const responses = await Promise.all([
        answer(requester.authorization, ticket, { answer: 'solved' }),
        answer(requester.authorization, ticket, { answer: 'not_solved' }),
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
      expect(
        responses.find(({ status }) => status === 409)?.body as { code: string },
      ).toMatchObject({ code: 'ticket.resolution_confirmation_not_pending' });
      expect(
        (await events(ticket.id)).filter(({ actorId }) => actorId === requester.user.id),
      ).toHaveLength(1);
    });

    it('answers a requester of an archived project with 409 project.archived', async () => {
      const { project, developer, requester, ticket } = await confirmationSetUp();
      await changeStatus(developer.authorization, ticket, { status: 'done' });
      await prisma.project.update({ where: { id: project.id }, data: { state: 'archived' } });

      const res = await answer(requester.authorization, ticket, { answer: 'solved' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'project.archived' });
    });
  });

  describe('the project lock of the field PATCH (Q23)', () => {
    it('changes nothing in a project archived while the edit waits for it', async () => {
      const { project, developer, ticket } = await setUp();

      let edit: Promise<request.Response> | undefined;
      await whileWaitingForShareLock(
        (tx) =>
          tx.project.update({
            where: { id: project.id },
            data: { state: 'archived', version: { increment: 1 } },
          }),
        () => {
          edit = http()
            .patch(`/api/v1/tickets/${ticket.id}`)
            .set('Authorization', developer.authorization)
            .set('If-Match', 'W/"1"')
            .send({ title: 'Edited after the archive' })
            .then((res) => res);
        },
      );
      const res = await (edit as Promise<request.Response>);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'project.archived' });
      expect((await read(ticket.id)).title).toBe(ticket.title);
    });
  });

  describe('check constraints', () => {
    it.each([
      ['a waiting ticket without its reason', { status: 'waiting_for_requester' as const }],
      ['a reason without waiting', { waitingReason: 'information' as const }],
      ['a terminal ticket without its closing time', { status: 'done' as const }],
      ['a closing time of an open ticket', { closedAt: new Date() }],
      [
        'a rejected ticket without its reason',
        { status: 'rejected' as const, closedAt: new Date() },
      ],
      ['a reason of a ticket that is not rejected', { rejectionReason: 'No' }],
    ])('refuses %s', async (_case, data) => {
      const { ticket } = await setUp();

      await expect(prisma.ticket.update({ where: { id: ticket.id }, data })).rejects.toThrow();
    });

    it('refuses a second duplicate_of of one ticket and a relation to itself', async () => {
      const { project, developer, ticket } = await setUp({ status: 'duplicate' });
      const [first, second] = await Promise.all(
        [1, 2].map(() =>
          createTicket(prisma, { projectId: project.id, requesterId: developer.user.id }),
        ),
      );
      await createDuplicateRelation(prisma, ticket, first as TicketRow);

      await expect(createDuplicateRelation(prisma, ticket, second as TicketRow)).rejects.toThrow();
      await expect(createDuplicateRelation(prisma, ticket, ticket)).rejects.toThrow();
    });
  });
});
