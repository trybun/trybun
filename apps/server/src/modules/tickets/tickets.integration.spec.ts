import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { createCaslExtension } from '@casl/prisma/runtime';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ActivityEventPage } from '@trybun/contracts/activity-events';
import type { EndUserTicket, Ticket, TicketPage } from '@trybun/contracts/tickets';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createActivityEvent } from '../../../test/factories/activity-event.factory.js';
import { createOrganization } from '../../../test/factories/organization.factory.js';
import { createProjectMember } from '../../../test/factories/project-member.factory.js';
import { buildProjectKey, createProject } from '../../../test/factories/project.factory.js';
import { createTicket } from '../../../test/factories/ticket.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { ApiModule } from '../../api.module.js';
import { PrismaClient, type Project, type User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { allocateTicketNumber } from './tickets.sql.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';

type Who = 'admin' | 'project_manager' | 'developer' | 'end_user';

/** The concurrent creations of the test of the counter (§17.2). */
const CONCURRENT_CREATIONS = 50;

describe('tickets endpoints', () => {
  const config = integrationConfig();
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiModule.forRoot(config)],
    })
      // Concurrent creations wait for the counter's row lock: the pool and the transaction
      // timeouts are set so that none of the creations fails while waiting.
      .overrideProvider(PrismaService)
      .useFactory({
        factory: () =>
          new PrismaClient({
            adapter: new PrismaPg({ connectionString: config.databaseUrl, max: 20 }),
            transactionOptions: { maxWait: 60_000, timeout: 60_000 },
          }).$extends(createCaslExtension()),
      })
      .compile();
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

  /** A signed-in account; team members with 2FA (§7.4), with their role in the project. */
  async function signIn(
    who: Who,
    options: { project?: Project; displayName?: string; personalAccess?: boolean } = {},
  ) {
    const user = await createUser(prisma, {
      keycloakUserId: randomUUID(),
      kind: who === 'end_user' ? 'end_user' : 'team',
      isAdmin: who === 'admin',
      ...(options.displayName === undefined ? {} : { displayName: options.displayName }),
    });
    if (options.project !== undefined && (who === 'project_manager' || who === 'developer')) {
      await createProjectMember(prisma, {
        projectId: options.project.id,
        userId: user.id,
        role: who,
      });
    }
    if (options.project !== undefined && who === 'end_user' && options.personalAccess !== false) {
      await createProjectMember(prisma, {
        projectId: options.project.id,
        userId: user.id,
        role: 'end_user',
      });
    }
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: who === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
    });
    return { user, authorization: `Bearer ${token}` };
  }

  const ifMatch = (ticket: { version: number }) => `W/"${ticket.version}"`;

  function create(authorization: string, body: Record<string, unknown>) {
    return http().post('/api/v1/tickets').set('Authorization', authorization).send(body);
  }

  function update(authorization: string, ticket: { id: string; version: number }, body: object) {
    return http()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set('Authorization', authorization)
      .set('If-Match', ifMatch(ticket))
      .send(body);
  }

  async function events(ticketId: string) {
    return prisma.activityEvent.findMany({
      where: { ticketId },
      select: { type: true, data: true, actorId: true, automaticSource: true, isPublic: true },
      orderBy: { id: 'asc' },
    });
  }

  describe('creating', () => {
    it(`numbers ${CONCURRENT_CREATIONS} concurrent creations 1–${CONCURRENT_CREATIONS} without gaps or duplicates`, async () => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('developer', { project });

      const responses = await Promise.all(
        Array.from({ length: CONCURRENT_CREATIONS }, (_, index) =>
          create(authorization, { projectId: project.id, title: `Ticket ${index}` }),
        ),
      );

      expect(responses.map(({ status }) => status)).toEqual(
        Array.from({ length: CONCURRENT_CREATIONS }, () => 201),
      );
      const numbers = responses.map(({ body }) => (body as Ticket).number).sort((a, b) => a - b);
      expect(numbers).toEqual(
        Array.from({ length: CONCURRENT_CREATIONS }, (_, index) => index + 1),
      );
    });

    it('leaves no gap after a rolled-back creation, and numbers each project on its own', async () => {
      const project = await createProject(prisma);
      const otherProject = await createProject(prisma);
      const { user, authorization } = await signIn('developer', { project });
      await createProjectMember(prisma, { projectId: otherProject.id, userId: user.id });

      const first = await create(authorization, { projectId: project.id, title: 'First' });
      // A creation that fails after drawing its number rolls the counter back with it.
      await expect(
        prisma.$transaction(async (tx) => {
          await allocateTicketNumber(tx, project.id);
          throw new Error('Rolled back');
        }),
      ).rejects.toThrow('Rolled back');
      const second = await create(authorization, { projectId: project.id, title: 'Second' });
      const elsewhere = await create(authorization, { projectId: otherProject.id, title: 'Other' });

      expect((first.body as Ticket).number).toBe(1);
      expect((second.body as Ticket).number).toBe(2);
      expect((elsewhere.body as Ticket).number).toBe(1);
    });

    it('creates a team ticket with the defaults of the team, a Location and no event', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('developer', { project });

      const res = await create(authorization, { projectId: project.id, title: '  Login fails  ' });

      expect(res.status).toBe(201);
      const ticket = res.body as Ticket;
      expect(res.headers.location).toBe(`/api/v1/tickets/${ticket.id}`);
      expect(res.headers.etag).toBe('W/"1"');
      expect(ticket).toMatchObject({
        projectId: project.id,
        number: 1,
        identifier: `${project.key}-1`,
        title: 'Login fails',
        description: '',
        type: 'task',
        source: 'developer',
        priority: 'normal',
        status: 'todo',
        organization: null,
        requester: { id: user.id, displayName: user.displayName },
        assignee: null,
        version: 1,
        allowedActions: ['read', 'update', 'update_fields', 'assign_self'],
      });
      expect(await events(ticket.id)).toEqual([]);
    });

    it("creates an end user's ticket in new, without type, with their organization", async () => {
      const project = await createProject(prisma);
      const organization = await createOrganization(prisma);
      await prisma.organizationProject.create({
        data: { organizationId: organization.id, projectId: project.id },
      });
      const { user, authorization } = await signIn('end_user', { project, personalAccess: false });
      await prisma.organizationMember.create({
        data: { userId: user.id, organizationId: organization.id },
      });

      const res = await create(authorization, {
        projectId: project.id,
        title: 'Invoice missing',
        description: 'Since **Monday**',
      });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(String) as string,
        projectId: project.id,
        number: 1,
        identifier: `${project.key}-1`,
        title: 'Invoice missing',
        description: 'Since **Monday**',
        requester: { id: user.id, displayName: user.displayName },
        version: 1,
        createdAt: expect.any(String) as string,
        updatedAt: expect.any(String) as string,
        allowedActions: ['read', 'update'],
      });
      expect(
        await prisma.ticket.findUniqueOrThrow({
          where: { id: (res.body as EndUserTicket).id },
          select: { source: true, status: true, type: true, priority: true, organizationId: true },
        }),
      ).toEqual({
        source: 'user',
        status: 'new',
        type: null,
        priority: 'normal',
        organizationId: organization.id,
      });
    });

    it.each([
      ['type', { type: 'bug' }],
      ['priority', { priority: 'high' }],
      ['assigneeId', { assigneeId: null }],
    ])(
      'refuses the full-form field %s to an end user with 403, creating nothing',
      async (_field, body) => {
        const project = await createProject(prisma);
        const { authorization } = await signIn('end_user', { project });

        const res = await create(authorization, { projectId: project.id, title: 'T', ...body });

        expect(res.status).toBe(403);
        expect(await prisma.ticket.count({ where: { projectId: project.id } })).toBe(0);
      },
    );

    it('takes the type and priority of the team and lets a Developer assign only themselves', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('developer', { project });
      const { user: colleague } = await signIn('developer', { project });

      const own = await create(authorization, {
        projectId: project.id,
        title: 'Mine',
        type: 'bug',
        priority: 'critical',
        assigneeId: user.id,
      });
      const other = await create(authorization, {
        projectId: project.id,
        title: 'Theirs',
        assigneeId: colleague.id,
      });

      expect(own.status).toBe(201);
      expect(own.body).toMatchObject({
        type: 'bug',
        priority: 'critical',
        assignee: { id: user.id, displayName: user.displayName },
      });
      expect(other.status).toBe(403);
    });

    it('answers an archived project with 409 project.archived and an invisible one with 404', async () => {
      const archived = await createProject(prisma, { state: 'archived' });
      const invisible = await createProject(prisma);
      const { authorization } = await signIn('admin');
      const { authorization: developer } = await signIn('developer', { project: archived });

      const resArchived = await create(authorization, { projectId: archived.id, title: 'T' });
      const resArchivedDeveloper = await create(developer, { projectId: archived.id, title: 'T' });
      const resInvisible = await create(developer, { projectId: invisible.id, title: 'T' });
      const resMissing = await create(developer, { projectId: randomUUID(), title: 'T' });

      expect(resArchived.status).toBe(409);
      expect(resArchived.body).toMatchObject({ code: 'project.archived' });
      expect(resArchivedDeveloper.status).toBe(409);
      expect(resInvisible.status).toBe(404);
      expect(resMissing.status).toBe(404);
    });
  });

  describe('reading', () => {
    it('finds a ticket by its identifier, and nothing when it is invisible', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('end_user', { project });
      const { authorization: other } = await signIn('end_user', { project });
      const ticket = await createTicket(prisma, {
        projectId: project.id,
        requesterId: user.id,
        source: 'user',
        status: 'new',
      });

      const found = await http()
        .get('/api/v1/tickets')
        .query({ identifier: `${project.key}-${ticket.number}` })
        .set('Authorization', authorization);
      const hidden = await http()
        .get('/api/v1/tickets')
        .query({ identifier: `${project.key}-${ticket.number}` })
        .set('Authorization', other);

      expect((found.body as TicketPage).items.map(({ id }) => id)).toEqual([ticket.id]);
      expect((hidden.body as TicketPage).items).toEqual([]);
    });

    it('rejects an identifier whose number no ticket can have with 422, not 500', async () => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('developer', { project });

      const res = await http()
        .get('/api/v1/tickets')
        .query({ identifier: `${project.key}-9999999999` })
        .set('Authorization', authorization);

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        errors: [{ pointer: '/identifier', code: 'string.invalid_format' }],
      });
    });

    it('lists the tickets of a project newest first, page by page', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('developer', { project });
      for (let index = 0; index < 3; index += 1) {
        await createTicket(prisma, { projectId: project.id, requesterId: user.id });
      }

      const first = await http()
        .get('/api/v1/tickets')
        .query({ projectId: project.id, limit: 2 })
        .set('Authorization', authorization);
      const second = await http()
        .get('/api/v1/tickets')
        .query({ projectId: project.id, limit: 2, cursor: (first.body as TicketPage).nextCursor })
        .set('Authorization', authorization);

      expect((first.body as TicketPage).items.map(({ number }) => number)).toEqual([3, 2]);
      expect((second.body as TicketPage).items.map(({ number }) => number)).toEqual([1]);
      expect((second.body as TicketPage).nextCursor).toBeNull();
    });

    it("shows an end user only their own tickets, without the team's fields", async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('end_user', { project });
      const { user: other } = await signIn('end_user', { project });
      const own = await createTicket(prisma, { projectId: project.id, requesterId: user.id });
      const foreign = await createTicket(prisma, { projectId: project.id, requesterId: other.id });

      const list = await http()
        .get('/api/v1/tickets')
        .query({ projectId: project.id })
        .set('Authorization', authorization);
      const detail = await http()
        .get(`/api/v1/tickets/${own.id}`)
        .set('Authorization', authorization);
      const foreignDetail = await http()
        .get(`/api/v1/tickets/${foreign.id}`)
        .set('Authorization', authorization);

      expect((list.body as TicketPage).items.map(({ id }) => id)).toEqual([own.id]);
      expect(Object.keys(detail.body as object).sort()).toEqual(
        [
          'allowedActions',
          'createdAt',
          'description',
          'id',
          'identifier',
          'number',
          'projectId',
          'requester',
          'title',
          'updatedAt',
          'version',
        ].sort(),
      );
      expect(foreignDetail.status).toBe(404);
    });

    it('answers a ticket of a project without access with 404', async () => {
      const project = await createProject(prisma);
      const { user } = await signIn('developer', { project });
      const ticket = await createTicket(prisma, { projectId: project.id, requesterId: user.id });
      const { authorization } = await signIn('developer', { project: await createProject(prisma) });

      const res = await http()
        .get(`/api/v1/tickets/${ticket.id}`)
        .set('Authorization', authorization);

      expect(res.status).toBe(404);
    });
  });

  describe('changing', () => {
    async function teamTicket(project: Project, requester: User) {
      return createTicket(prisma, { projectId: project.id, requesterId: requester.id });
    }

    it('records every field change with its previous and new value', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('project_manager', { project });
      const { user: developer } = await signIn('developer', { project, displayName: 'Ewa Nowak' });
      const ticket = await createTicket(prisma, {
        projectId: project.id,
        requesterId: user.id,
        title: 'Login fails',
        description: 'Steps',
      });

      const res = await update(authorization, ticket, {
        title: 'Sign-in fails',
        description: 'More steps',
        type: 'bug',
        priority: 'high',
        assigneeId: developer.id,
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        title: 'Sign-in fails',
        version: 2,
        assignee: { id: developer.id, displayName: 'Ewa Nowak' },
      });
      expect(res.headers.etag).toBe('W/"2"');
      const actor = { actorId: user.id, automaticSource: null, isPublic: false };
      expect(await events(ticket.id)).toEqual([
        { type: 'title_changed', data: { from: 'Login fails', to: 'Sign-in fails' }, ...actor },
        { type: 'description_edited', data: null, ...actor },
        { type: 'type_changed', data: { from: 'task', to: 'bug' }, ...actor },
        { type: 'priority_changed', data: { from: 'normal', to: 'high' }, ...actor },
        {
          type: 'assignee_changed',
          data: { from: null, to: { id: developer.id, displayName: 'Ewa Nowak' } },
          ...actor,
        },
      ]);
    });

    it('lists the events with the actor as now and the snapshots as then', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('project_manager', { project });
      const { user: developer } = await signIn('developer', { project, displayName: 'Ewa Nowak' });
      const ticket = await teamTicket(project, user);
      await update(authorization, ticket, { assigneeId: developer.id });
      await prisma.user.update({
        where: { id: developer.id },
        data: { displayName: 'Ewa Kowalska' },
      });
      await prisma.user.update({ where: { id: user.id }, data: { displayName: 'Jan Nowy' } });

      const res = await http()
        .get(`/api/v1/tickets/${ticket.id}/activity-events`)
        .set('Authorization', authorization);

      expect(res.status).toBe(200);
      expect((res.body as ActivityEventPage).items).toEqual([
        {
          id: expect.any(String) as string,
          type: 'assignee_changed',
          data: { from: null, to: { id: developer.id, displayName: 'Ewa Nowak' } },
          actor: { id: user.id, displayName: 'Jan Nowy' },
          automaticSource: null,
          createdAt: expect.any(String) as string,
        },
      ]);
    });

    it('shows an end user no internal event', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('end_user', { project });
      const ticket = await createTicket(prisma, { projectId: project.id, requesterId: user.id });
      await createActivityEvent(prisma, { ticketId: ticket.id });

      const res = await http()
        .get(`/api/v1/tickets/${ticket.id}/activity-events`)
        .set('Authorization', authorization);

      expect(res.status).toBe(200);
      expect((res.body as ActivityEventPage).items).toEqual([]);
    });

    it('lets the requester edit the title, but not the fields of the team', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('end_user', { project });
      const ticket = await createTicket(prisma, { projectId: project.id, requesterId: user.id });

      const title = await update(authorization, ticket, { title: 'Clearer title' });
      const priority = await update(authorization, { ...ticket, version: 2 }, { priority: 'high' });

      expect(title.status).toBe(200);
      expect(priority.status).toBe(403);
    });

    it('lets a requester who lost access to the project read, but not edit', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('end_user', { project });
      const ticket = await createTicket(prisma, { projectId: project.id, requesterId: user.id });
      await prisma.projectMember.delete({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
      });

      const read = await http()
        .get(`/api/v1/tickets/${ticket.id}`)
        .set('Authorization', authorization);
      const edit = await update(authorization, ticket, { title: 'Clearer title' });

      expect(read.status).toBe(200);
      expect((read.body as EndUserTicket).allowedActions).toEqual(['read']);
      expect(edit.status).toBe(403);
    });

    it('rejects another project with ticket.project_immutable and accepts the same one', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('developer', { project });
      const ticket = await teamTicket(project, user);

      const moved = await update(authorization, ticket, { projectId: randomUUID() });
      const same = await update(authorization, ticket, { projectId: project.id });

      expect(moved.status).toBe(422);
      expect(moved.body).toMatchObject({
        code: 'ticket.project_immutable',
        errors: [{ pointer: '/projectId', code: 'field.invalid' }],
      });
      expect(same.status).toBe(200);
      expect(same.body).toMatchObject({ projectId: project.id, version: 1 });
      expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({
        projectId: project.id,
        version: 1,
      });
    });

    it('changes nothing for an unchanged body, but still checks the version', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('developer', { project });
      const ticket = await teamTicket(project, user);

      const unchanged = await update(authorization, ticket, { title: ticket.title });
      const stale = await update(authorization, { ...ticket, version: 7 }, { title: ticket.title });

      expect(unchanged.status).toBe(200);
      expect(unchanged.body).toMatchObject({ version: 1 });
      expect(stale.status).toBe(412);
      expect(await events(ticket.id)).toEqual([]);
    });

    it.each(['developer', 'project_manager'] as const)(
      'changes nothing when a %s sends no assignee for an unassigned ticket',
      async (who) => {
        const project = await createProject(prisma);
        const { user, authorization } = await signIn(who, { project });
        const ticket = await teamTicket(project, user);

        const res = await update(authorization, ticket, { assigneeId: null });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ assignee: null, version: 1 });
        expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({
          version: 1,
        });
        expect(await events(ticket.id)).toEqual([]);
      },
    );

    it('answers a stale version with 412 and a missing one with 428', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('developer', { project });
      const ticket = await teamTicket(project, user);
      await update(authorization, ticket, { title: 'Changed' });

      const stale = await update(authorization, ticket, { title: 'Again' });
      const missing = await http()
        .patch(`/api/v1/tickets/${ticket.id}`)
        .set('Authorization', authorization)
        .send({ title: 'Again' });

      expect(stale.status).toBe(412);
      expect(missing.status).toBe(428);
    });

    it('lets a Developer assign and unassign only themselves', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('developer', { project });
      const { user: colleague } = await signIn('developer', { project });
      const ticket = await createTicket(prisma, {
        projectId: project.id,
        requesterId: user.id,
        assigneeId: colleague.id,
      });

      const takeOver = await update(authorization, ticket, { assigneeId: user.id });
      const unassign = await update(authorization, { ...ticket, version: 2 }, { assigneeId: null });
      const other = await update(
        authorization,
        { ...ticket, version: 3 },
        {
          assigneeId: colleague.id,
        },
      );

      expect(takeOver.status).toBe(200);
      expect(unassign.status).toBe(200);
      expect(unassign.body).toMatchObject({ assignee: null, version: 3 });
      expect(other.status).toBe(403);
    });

    it('lets a Developer not unassign someone else', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('developer', { project });
      const { user: colleague } = await signIn('developer', { project });
      const ticket = await createTicket(prisma, {
        projectId: project.id,
        requesterId: user.id,
        assigneeId: colleague.id,
      });

      const res = await update(authorization, ticket, { assigneeId: null });

      expect(res.status).toBe(403);
    });

    it.each([
      ['no member of the project', async (): Promise<User> => createUser(prisma, { kind: 'team' })],
      [
        'a deactivated member',
        async (project: Project) => {
          const user = await createUser(prisma, { kind: 'team', state: 'deactivated' });
          await createProjectMember(prisma, { projectId: project.id, userId: user.id });
          return user;
        },
      ],
      [
        'an end user with personal access',
        async (project: Project) => {
          const user = await createUser(prisma, { kind: 'end_user' });
          await createProjectMember(prisma, {
            projectId: project.id,
            userId: user.id,
            role: 'end_user',
          });
          return user;
        },
      ],
    ])('refuses %s as assignee with 422 ticket.assignee_not_eligible', async (_case, assignee) => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('project_manager', { project });
      const ticket = await teamTicket(project, user);

      const res = await update(authorization, ticket, { assigneeId: (await assignee(project)).id });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        code: 'ticket.assignee_not_eligible',
        errors: [{ pointer: '/assigneeId', code: 'field.invalid' }],
      });
    });

    it('refuses every change of a ticket of an archived project with 409', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('project_manager', { project });
      const ticket = await teamTicket(project, user);
      await prisma.project.update({ where: { id: project.id }, data: { state: 'archived' } });

      const res = await update(authorization, ticket, { title: 'Changed' });
      const read = await http()
        .get(`/api/v1/tickets/${ticket.id}`)
        .set('Authorization', authorization);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'project.archived' });
      expect((read.body as Ticket).allowedActions).toEqual(['read']);
    });
  });

  describe('the organization snapshot', () => {
    it('never fails a creation racing the deletion of the organization', async () => {
      const { authorization: admin } = await signIn('admin');
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const project = await createProject(prisma);
        const organization = await createOrganization(prisma);
        // Personal access keeps the project visible whatever happens to the organization.
        const { user, authorization } = await signIn('end_user', { project });
        await prisma.organizationMember.create({
          data: { userId: user.id, organizationId: organization.id },
        });

        const [created, deleted] = await Promise.all([
          create(authorization, { projectId: project.id, title: 'Invoice missing' }),
          http()
            .delete(`/api/v1/organizations/${organization.id}`)
            .set('Authorization', admin)
            .set('If-Match', ifMatch(organization)),
        ]);

        expect(created.status).toBe(201);
        const { organizationId } = await prisma.ticket.findUniqueOrThrow({
          where: { id: (created.body as EndUserTicket).id },
          select: { organizationId: true },
        });
        if (deleted.status === 204) {
          // The deletion committed first: the requester had no organization any more.
          expect(organizationId).toBeNull();
        } else {
          expect(deleted.body).toMatchObject({ code: 'organization.not_empty' });
          expect(organizationId).toBe(organization.id);
        }
      }
    });
  });

  describe('the frozen key', () => {
    it('never leaves a ticket under a key changed after it (§3.1)', async () => {
      const { authorization: admin } = await signIn('admin');
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const project = await createProject(prisma);
        const { authorization } = await signIn('developer', { project });
        const key = buildProjectKey();

        const [created, changed] = await Promise.all([
          create(authorization, { projectId: project.id, title: 'First' }),
          http()
            .patch(`/api/v1/projects/${project.id}`)
            .set('Authorization', admin)
            .set('If-Match', ifMatch(project))
            .send({ key }),
        ]);

        expect(created.status).toBe(201);
        if (changed.status === 200) {
          // The key changed first: the ticket was created under the new key.
          expect((created.body as Ticket).identifier).toBe(`${key}-1`);
        } else {
          expect(changed.body).toMatchObject({ code: 'project.key_immutable' });
          expect((created.body as Ticket).identifier).toBe(`${project.key}-1`);
        }
      }
    });
  });

  describe('the activity history', () => {
    it('refuses to update or delete an event, but goes with its ticket', async () => {
      const project = await createProject(prisma);
      const user = await createUser(prisma, { kind: 'team' });
      const ticket = await createTicket(prisma, { projectId: project.id, requesterId: user.id });
      const event = await createActivityEvent(prisma, { ticketId: ticket.id, actorId: user.id });

      await expect(
        prisma.activityEvent.update({
          where: { id: event.id },
          data: { type: 'priority_changed' },
        }),
      ).rejects.toThrow(/immutable/);
      await expect(prisma.activityEvent.delete({ where: { id: event.id } })).rejects.toThrow(
        /immutable/,
      );
      await expect(prisma.$executeRaw`TRUNCATE "activity_events"`).rejects.toThrow(/immutable/);

      // Undoing an import deletes tickets (§12.5); their events go with them.
      await prisma.ticket.delete({ where: { id: ticket.id } });
      expect(await prisma.activityEvent.count({ where: { id: event.id } })).toBe(0);
    });
  });
});
