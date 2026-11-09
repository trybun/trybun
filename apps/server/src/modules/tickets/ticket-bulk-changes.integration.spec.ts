// Bulk changes of the ticket list (S1-13, §8.1, §17.2): each ticket is checked and changed on its
// own through its single-change use case, and the response reports a result per ticket.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { BulkChangeTicketsResponse } from '@trybun/contracts/tickets';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createProjectMember } from '../../../test/factories/project-member.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createTicket } from '../../../test/factories/ticket.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { ApiModule } from '../../api.module.js';
import type { Project, Ticket } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';

type Who = 'project_manager' | 'developer' | 'end_user';

/** 100 tickets run one after another, each in its own transaction (S1-13 Q2). */
const LARGEST_BULK_TIMEOUT = 60_000;
/**
 * The duration a person waits for the largest bulk change at most; nearing it reopens Q2's
 * alternative of a Worker job with a result resource.
 */
const LARGEST_BULK_BUDGET_MS = 30_000;

describe('ticket bulk changes (S1-13)', () => {
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

  async function signIn(who: Who, project?: Project) {
    const user = await createUser(prisma, {
      keycloakUserId: randomUUID(),
      kind: who === 'end_user' ? 'end_user' : 'team',
    });
    if (project !== undefined) {
      await createProjectMember(prisma, { projectId: project.id, userId: user.id, role: who });
    }
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: who === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
    });
    return { user, authorization: `Bearer ${token}` };
  }

  function bulk(authorization: string, tickets: Pick<Ticket, 'id' | 'version'>[], change: object) {
    return http()
      .post('/api/v1/tickets/bulk-changes')
      .set('Authorization', authorization)
      .send({ tickets: tickets.map(({ id, version }) => ({ id, version })), change });
  }

  const http = () => request(app.getHttpServer());

  async function tickets(project: Project, requesterId: string, count: number, fields = {}) {
    const created: Ticket[] = [];
    for (let index = 0; index < count; index += 1) {
      created.push(await createTicket(prisma, { projectId: project.id, requesterId, ...fields }));
    }
    return created;
  }

  const results = (res: { body: unknown }) => (res.body as BulkChangeTicketsResponse).results;

  it('reports 19 successes and 1 conflict for 20 tickets with one stale version', async () => {
    const project = await createProject(prisma);
    const manager = await signIn('project_manager', project);
    const all = await tickets(project, manager.user.id, 20, { priority: 'normal' });
    const stale = all[7]!;
    await prisma.ticket.update({ where: { id: stale.id }, data: { version: { increment: 1 } } });

    const res = await bulk(manager.authorization, all, { field: 'priority', priority: 'high' });

    expect(res.status).toBe(200);
    const byStatus = results(res).map(({ status }) => status);
    expect(byStatus.filter((status) => status === 200)).toHaveLength(19);
    expect(results(res)[7]).toEqual({
      id: stale.id,
      status: 412,
      code: 'request.precondition_failed',
    });
    expect(results(res).map(({ id }) => id)).toEqual(all.map(({ id }) => id));
    const first = results(res)[0];
    expect(first?.status === 200 && first.ticket).toMatchObject({ priority: 'high', version: 2 });
    expect(first?.status === 200 && first.ticket).not.toHaveProperty('description');
    // Each changed ticket records its own event, as a single change does (§4.5).
    expect(
      await prisma.activityEvent.count({
        where: { ticketId: { in: all.map(({ id }) => id) }, type: 'priority_changed' },
      }),
    ).toBe(19);
  });

  it('reports an invisible ticket as 404 whatever its version, before every other check', async () => {
    const project = await createProject(prisma);
    const hidden = await createProject(prisma);
    const manager = await signIn('project_manager', project);
    const [visible] = await tickets(project, manager.user.id, 1);
    const [invisible] = await tickets(hidden, manager.user.id, 1);

    const res = await bulk(
      manager.authorization,
      [visible!, { id: invisible!.id, version: 99 }, { id: randomUUID(), version: 1 }],
      { field: 'status', status: 'in_progress' },
    );

    expect(results(res).map(({ status }) => status)).toEqual([200, 404, 404]);
    expect(results(res)[1]).toMatchObject({ code: 'request.not_found' });
  });

  it('refuses a Developer assigning someone else for that ticket only (403, 422)', async () => {
    const project = await createProject(prisma);
    const developer = await signIn('developer', project);
    const colleague = await signIn('developer', project);
    const outsider = await createUser(prisma, { kind: 'team' });
    const [first, second] = await tickets(project, developer.user.id, 2);

    const self = await bulk(developer.authorization, [first!, second!], {
      field: 'assignee',
      assigneeId: developer.user.id,
    });
    expect(results(self).map(({ status }) => status)).toEqual([200, 200]);

    const other = await bulk(developer.authorization, [{ ...first!, version: 2 }], {
      field: 'assignee',
      assigneeId: colleague.user.id,
    });
    expect(results(other)).toEqual([{ id: first!.id, status: 403, code: 'request.forbidden' }]);

    const manager = await signIn('project_manager', project);
    const ineligible = await bulk(manager.authorization, [{ ...first!, version: 2 }], {
      field: 'assignee',
      assigneeId: outsider.id,
    });
    expect(results(ineligible)).toEqual([
      { id: first!.id, status: 422, code: 'ticket.assignee_not_eligible' },
    ]);
  });

  it('reports a ticket of an archived project as 409 project.archived', async () => {
    const project = await createProject(prisma);
    const manager = await signIn('project_manager', project);
    const [ticket] = await tickets(project, manager.user.id, 1);
    await prisma.project.update({ where: { id: project.id }, data: { state: 'archived' } });

    const res = await bulk(manager.authorization, [ticket!], {
      field: 'priority',
      priority: 'low',
    });

    expect(results(res)).toEqual([{ id: ticket!.id, status: 409, code: 'project.archived' }]);
  });

  it('rejects every ticket with the one reason, each with its own public comment (S1-12)', async () => {
    const project = await createProject(prisma);
    const manager = await signIn('project_manager', project);
    const all = await tickets(project, manager.user.id, 3);

    const res = await bulk(manager.authorization, all, {
      field: 'status',
      status: 'rejected',
      rejectionReason: 'Out of scope',
    });

    expect(results(res).map(({ status }) => status)).toEqual([200, 200, 200]);
    const comments = await prisma.comment.findMany({
      where: { ticketId: { in: all.map(({ id }) => id) } },
      select: { ticketId: true, kind: true },
    });
    expect(comments.map(({ ticketId }) => ticketId).sort()).toEqual(all.map(({ id }) => id).sort());
    expect(new Set(comments.map(({ kind }) => kind))).toEqual(new Set(['public']));
  });

  it('returns the actual status after the redirect of done to the confirmation (S1-06)', async () => {
    const project = await createProject(prisma, { confirmResolution: true });
    const manager = await signIn('project_manager', project);
    const requester = await signIn('end_user', project);
    const [ticket] = await tickets(project, requester.user.id, 1, {
      source: 'user',
      status: 'in_verification',
    });

    const res = await bulk(manager.authorization, [ticket!], { field: 'status', status: 'done' });

    const [result] = results(res);
    expect(result?.status === 200 && result.ticket).toMatchObject({
      status: 'waiting_for_requester',
      waitingReason: 'confirmation',
    });
  });

  it.each([
    ['duplicate', { field: 'status', status: 'duplicate' }, '/change/status'],
    [
      'rejected without a reason',
      { field: 'status', status: 'rejected' },
      '/change/rejectionReason',
    ],
  ])('rejects %s as a whole with 422', async (_case, change, pointer) => {
    const project = await createProject(prisma);
    const manager = await signIn('project_manager', project);
    const [ticket] = await tickets(project, manager.user.id, 1);

    const res = await bulk(manager.authorization, [ticket!], change);

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ errors: [{ pointer }] });
  });

  it('rejects repeated IDs and more than 100 tickets with 422', async () => {
    const project = await createProject(prisma);
    const manager = await signIn('project_manager', project);
    const [ticket] = await tickets(project, manager.user.id, 1);
    const change = { field: 'priority', priority: 'low' };

    const repeated = await bulk(manager.authorization, [ticket!, ticket!], change);
    expect(repeated.status).toBe(422);
    expect(repeated.body).toMatchObject({
      errors: [{ pointer: '/tickets/1/id', code: 'field.invalid' }],
    });

    const many = Array.from({ length: 101 }, () => ({ id: randomUUID(), version: 1 }));
    const tooMany = await bulk(manager.authorization, many, change);
    expect(tooMany.status).toBe(422);
    expect(tooMany.body).toMatchObject({
      errors: [{ pointer: '/tickets', code: 'array.too_long' }],
    });
  });

  it('reports an end user’s own ticket as not permitted', async () => {
    const project = await createProject(prisma);
    const requester = await signIn('end_user', project);
    const [ticket] = await tickets(project, requester.user.id, 1, { source: 'user' });

    const res = await bulk(requester.authorization, [ticket!], {
      field: 'priority',
      priority: 'high',
    });

    expect(results(res)).toEqual([{ id: ticket!.id, status: 403, code: 'request.forbidden' }]);
  });

  it(
    'changes 100 tickets in one request within the request timeout (S1-13 Q2)',
    async () => {
      const project = await createProject(prisma);
      const manager = await signIn('project_manager', project);
      const all = await tickets(project, manager.user.id, 100);

      const started = performance.now();
      const res = await bulk(manager.authorization, all, {
        field: 'status',
        status: 'in_progress',
      });
      const duration = performance.now() - started;
      process.stdout.write(`Bulk change of 100 tickets: ${Math.round(duration)} ms\n`);

      expect(results(res).every(({ status }) => status === 200)).toBe(true);
      expect(duration).toBeLessThan(LARGEST_BULK_BUDGET_MS);
    },
    LARGEST_BULK_TIMEOUT,
  );
});
