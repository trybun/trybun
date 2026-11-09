// The API of the end-user portal (S1-09): the end-user shapes of tickets, projects and events
// parsed with strict schemas – an internal field fails the parse instead of being stripped –,
// public status events with public codes only, "My tickets" (`involvement=mine`) and the project
// reference of tickets.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ActivityEventPage } from '@trybun/contracts/activity-events';
import type { Ticket, TicketPage } from '@trybun/contracts/tickets';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  strictEndUserActivityEventSchema,
  strictEndUserProjectSchema,
  strictEndUserTicketSchema,
  strictPageSchema,
} from '../../../test/end-user-schemas.js';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createProjectMember } from '../../../test/factories/project-member.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createTicket, type TicketFactoryInput } from '../../../test/factories/ticket.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { ApiModule } from '../../api.module.js';
import type { Project } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';

type Who = 'developer' | 'end_user';

const strictTicketPageSchema = strictPageSchema(strictEndUserTicketSchema);
const strictEventPageSchema = strictPageSchema(strictEndUserActivityEventSchema);

describe('the API of the end-user portal', () => {
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

  /** A signed-in account with access to the projects; team members with 2FA (§7.4). */
  async function signIn(who: Who, ...projects: Project[]) {
    const user = await createUser(prisma, {
      keycloakUserId: randomUUID(),
      kind: who === 'end_user' ? 'end_user' : 'team',
    });
    for (const project of projects) {
      await createProjectMember(prisma, { projectId: project.id, userId: user.id, role: who });
    }
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: who === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
    });
    return { user, authorization: `Bearer ${token}` };
  }

  function get(authorization: string, path: string, query: object = {}) {
    return http().get(`/api/v1${path}`).query(query).set('Authorization', authorization);
  }

  async function changeStatus(authorization: string, ticketId: string, body: object) {
    const current = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { version: true },
    });
    const res = await http()
      .put(`/api/v1/tickets/${ticketId}/status`)
      .set('Authorization', authorization)
      .set('If-Match', `W/"${current.version}"`)
      .send(body);
    expect(res.status).toBe(200);
    return res.body as Ticket;
  }

  async function update(authorization: string, ticketId: string, body: object) {
    const current = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { version: true },
    });
    const res = await http()
      .patch(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', authorization)
      .set('If-Match', `W/"${current.version}"`)
      .send(body);
    expect(res.status).toBe(200);
  }

  /** Every page of "My tickets", following `nextCursor` until the last page. */
  async function allPagesOfMine(authorization: string, query: object) {
    const pages: TicketPage[] = [];
    let cursor: string | null | undefined;
    do {
      const res = await get(authorization, '/tickets', {
        involvement: 'mine',
        ...query,
        ...(cursor === undefined ? {} : { cursor }),
      });
      expect(res.status).toBe(200);
      const page = res.body as TicketPage;
      pages.push(page);
      cursor = page.nextCursor;
    } while (cursor !== null);
    return pages;
  }

  describe('end-user responses', () => {
    it('carry no internal field of a ticket, its project or its events', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('end_user', project);
      const { authorization: team } = await signIn('developer', project);
      const created = await http()
        .post('/api/v1/tickets')
        .set('Authorization', authorization)
        .send({ projectId: project.id, title: 'Invoice missing' });
      const ticketId = strictEndUserTicketSchema.parse(created.body).id;
      await createTicket(prisma, { projectId: project.id, requesterId: user.id });
      await changeStatus(team, ticketId, { status: 'in_verification' });

      const detail = await get(authorization, `/tickets/${ticketId}`);
      const list = await get(authorization, '/tickets', { projectId: project.id });
      const mine = await get(authorization, '/tickets', { involvement: 'mine' });
      const events = await get(authorization, `/tickets/${ticketId}/activity-events`);
      const projectDetail = await get(authorization, `/projects/${project.id}`);
      const projects = await get(authorization, '/projects');

      expect(strictEndUserTicketSchema.parse(detail.body)).toMatchObject({
        publicStatus: 'in_progress',
        publicStatusDescription: 'testing',
      });
      expect(strictTicketPageSchema.parse(list.body).items).toHaveLength(2);
      expect(strictTicketPageSchema.parse(mine.body).items).toHaveLength(2);
      expect(strictEventPageSchema.parse(events.body).items).toHaveLength(1);
      strictEndUserProjectSchema.parse(projectDetail.body);
      strictPageSchema(strictEndUserProjectSchema).parse(projects.body);
    });

    it.each([
      ['new', null, 'received'],
      ['triage', null, 'analyzing'],
      ['todo', null, 'scheduled'],
      ['in_progress', null, 'working'],
      ['waiting_for_requester', 'information', 'information_needed'],
      ['waiting_for_requester', 'confirmation', 'confirmation_needed'],
      ['done', null, 'resolved'],
      ['rejected', null, 'rejected'],
    ] as const)(
      'describe a ticket in %s (reason %s) as %s',
      async (status, waitingReason, description) => {
        const project = await createProject(prisma);
        const { user, authorization } = await signIn('end_user', project);
        const ticket = await createTicket(prisma, {
          projectId: project.id,
          requesterId: user.id,
          status,
          ...(waitingReason === null ? {} : { waitingReason }),
        });

        const res = await get(authorization, `/tickets/${ticket.id}`);

        expect(strictEndUserTicketSchema.parse(res.body).publicStatusDescription).toBe(description);
      },
    );
  });

  describe('the public timeline', () => {
    it('never shows an internal event, and shows status changes with public codes only', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('end_user', project);
      const { authorization: team } = await signIn('developer', project);
      const ticket = await createTicket(prisma, {
        projectId: project.id,
        requesterId: user.id,
        source: 'user',
        status: 'new',
      });
      const original = await createTicket(prisma, { projectId: project.id, requesterId: user.id });
      await changeStatus(team, ticket.id, { status: 'in_progress' });
      await update(team, ticket.id, { title: 'Invoice of October missing', priority: 'high' });
      await changeStatus(team, ticket.id, { status: 'in_verification' });
      await changeStatus(team, ticket.id, { status: 'waiting_for_requester' });
      await changeStatus(team, ticket.id, {
        status: 'duplicate',
        duplicateOfTicketId: original.id,
      });

      const endUser = await get(authorization, `/tickets/${ticket.id}/activity-events`);
      const teamView = await get(team, `/tickets/${ticket.id}/activity-events`);

      const items = strictEventPageSchema.parse(endUser.body).items;
      expect(items.map(({ type, data }) => ({ type, data }))).toEqual([
        { type: 'status_changed', data: { from: 'received', to: 'in_progress' } },
        { type: 'status_changed', data: { from: 'in_progress', to: 'awaiting_reply' } },
        {
          type: 'status_changed',
          data: {
            from: 'awaiting_reply',
            to: 'closed',
            duplicateOf: { id: original.id, number: original.number, projectKey: project.key },
          },
        },
      ]);
      expect(items.every(({ actor }) => actor !== null)).toBe(true);
      // The team sees every event with the internal codes.
      expect((teamView.body as ActivityEventPage).items.map(({ type }) => type)).toEqual([
        'status_changed',
        'title_changed',
        'priority_changed',
        'status_changed',
        'status_changed',
        'status_changed',
      ]);
      expect((teamView.body as ActivityEventPage).items[0]?.data).toMatchObject({
        from: 'new',
        to: 'in_progress',
        reopen: false,
      });
    });

    it('leaves out the original of a duplicate the requester may not read', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('end_user', project);
      const { user: other } = await signIn('end_user', project);
      const { authorization: team } = await signIn('developer', project);
      const ticket = await createTicket(prisma, { projectId: project.id, requesterId: user.id });
      const original = await createTicket(prisma, { projectId: project.id, requesterId: other.id });
      await changeStatus(team, ticket.id, {
        status: 'duplicate',
        duplicateOfTicketId: original.id,
      });

      const events = await get(authorization, `/tickets/${ticket.id}/activity-events`);
      const detail = await get(authorization, `/tickets/${ticket.id}`);

      expect(strictEventPageSchema.parse(events.body).items.map(({ data }) => data)).toEqual([
        { from: 'in_progress', to: 'closed' },
      ]);
      expect(strictEndUserTicketSchema.parse(detail.body)).toMatchObject({
        publicStatusDescription: 'merged',
        duplicateOf: null,
      });
    });
  });

  describe('My tickets (involvement=mine)', () => {
    it('lists only the requested tickets, awaiting a reply first, each once across pages', async () => {
      const first = await createProject(prisma);
      const second = await createProject(prisma);
      const { user, authorization } = await signIn('end_user', first, second);
      const { user: other } = await signIn('end_user', first);
      const { user: developer } = await signIn('developer', first);
      const at = (minutes: number) => new Date(Date.UTC(2026, 10, 1, 12, minutes));
      const own = (input: Partial<TicketFactoryInput>) =>
        createTicket(prisma, { projectId: first.id, requesterId: user.id, ...input });
      // Two tickets share an update time, so the ID decides between them on a page boundary.
      const latest = await own({ updatedAt: at(50) });
      const tieA = await own({ projectId: second.id, updatedAt: at(40) });
      const tieB = await own({ updatedAt: at(40) });
      const oldest = await own({ status: 'done', updatedAt: at(10) });
      const awaitingOld = await own({ status: 'waiting_for_requester', updatedAt: at(5) });
      const awaitingNew = await own({
        projectId: second.id,
        status: 'waiting_for_requester',
        waitingReason: 'confirmation',
        updatedAt: at(20),
      });
      await createTicket(prisma, { projectId: first.id, requesterId: other.id, updatedAt: at(55) });
      await createTicket(prisma, {
        projectId: first.id,
        requesterId: developer.id,
        updatedAt: at(56),
      });

      const pages = await allPagesOfMine(authorization, { limit: 2 });
      const ids = pages.flatMap((page) =>
        strictTicketPageSchema.parse(page).items.map(({ id }) => id),
      );

      const [tieFirst, tieSecond] = [tieA, tieB].sort((a, b) => b.id.localeCompare(a.id));
      expect(ids).toEqual([
        awaitingNew.id,
        awaitingOld.id,
        latest.id,
        tieFirst?.id,
        tieSecond?.id,
        oldest.id,
      ]);
      expect(pages).toHaveLength(3);
      expect(pages[0]?.items.map(({ publicStatus }) => publicStatus)).toEqual([
        'awaiting_reply',
        'awaiting_reply',
      ]);
    });

    it('filters by project and refuses an identifier with 422', async () => {
      const first = await createProject(prisma);
      const second = await createProject(prisma);
      const { user, authorization } = await signIn('end_user', first, second);
      const inFirst = await createTicket(prisma, { projectId: first.id, requesterId: user.id });
      await createTicket(prisma, { projectId: second.id, requesterId: user.id });

      const filtered = await get(authorization, '/tickets', {
        involvement: 'mine',
        projectId: first.id,
      });
      const withIdentifier = await get(authorization, '/tickets', {
        involvement: 'mine',
        identifier: `${first.key}-1`,
      });

      expect((filtered.body as TicketPage).items.map(({ id }) => id)).toEqual([inFirst.id]);
      expect(withIdentifier.status).toBe(422);
      expect(withIdentifier.body).toMatchObject({
        errors: [{ pointer: '/identifier', code: 'field.invalid' }],
      });
    });

    it('gives a team member who left a project a shorter page with a cursor', async () => {
      const left = await createProject(prisma);
      const kept = await createProject(prisma);
      const { user, authorization } = await signIn('developer', left, kept);
      const at = (minutes: number) => new Date(Date.UTC(2026, 10, 1, 12, minutes));
      const newest = await createTicket(prisma, {
        projectId: kept.id,
        requesterId: user.id,
        updatedAt: at(30),
      });
      await createTicket(prisma, { projectId: left.id, requesterId: user.id, updatedAt: at(20) });
      const older = await createTicket(prisma, {
        projectId: kept.id,
        requesterId: user.id,
        updatedAt: at(10),
      });
      await prisma.projectMember.delete({
        where: { projectId_userId: { projectId: left.id, userId: user.id } },
      });

      const pages = await allPagesOfMine(authorization, { limit: 2 });

      expect(pages.map((page) => page.items.map(({ id }) => id))).toEqual([
        [newest.id],
        [older.id],
      ]);
      expect(pages[0]?.nextCursor).not.toBeNull();
    });
  });

  describe('the project reference', () => {
    it('stays on the tickets of an archived project and after the requester lost access', async () => {
      const archived = await createProject(prisma);
      const leftProject = await createProject(prisma);
      const { user, authorization } = await signIn('end_user', archived, leftProject);
      const inArchived = await createTicket(prisma, {
        projectId: archived.id,
        requesterId: user.id,
      });
      const inLeft = await createTicket(prisma, {
        projectId: leftProject.id,
        requesterId: user.id,
      });
      await prisma.project.update({ where: { id: archived.id }, data: { state: 'archived' } });
      await prisma.projectMember.delete({
        where: { projectId_userId: { projectId: leftProject.id, userId: user.id } },
      });

      const archivedDetail = await get(authorization, `/tickets/${inArchived.id}`);
      const leftDetail = await get(authorization, `/tickets/${inLeft.id}`);
      const mine = await get(authorization, '/tickets', { involvement: 'mine' });
      const leftProjectDetail = await get(authorization, `/projects/${leftProject.id}`);

      const reference = (project: Project) => ({
        id: project.id,
        key: project.key,
        name: project.name,
      });
      expect(strictEndUserTicketSchema.parse(archivedDetail.body).project).toEqual(
        reference(archived),
      );
      expect(strictEndUserTicketSchema.parse(leftDetail.body).project).toEqual(
        reference(leftProject),
      );
      expect(
        strictTicketPageSchema
          .parse(mine.body)
          .items.map(({ project }) => project)
          .sort((a, b) => a.id.localeCompare(b.id)),
      ).toEqual(
        [reference(archived), reference(leftProject)].sort((a, b) => a.id.localeCompare(b.id)),
      );
      expect(leftProjectDetail.status).toBe(404);
    });

    it('is on the team ticket response too', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('developer', project);
      const ticket = await createTicket(prisma, { projectId: project.id, requesterId: user.id });

      const res = await get(authorization, `/tickets/${ticket.id}`);

      expect((res.body as Ticket).project).toEqual({
        id: project.id,
        key: project.key,
        name: project.name,
      });
      expect(res.body).not.toHaveProperty('publicStatusDescription');
    });
  });
});
