// The team's ticket list (S1-13, §8.1): filters, sorting with stable cursor pages, the team-only
// parameters, list items without the description, and the names of organizations for the filter.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OrganizationPage } from '@trybun/contracts/organizations';
import type { TicketListItem, TicketPage } from '@trybun/contracts/tickets';
import type { CurrentUser } from '@trybun/contracts/users';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createOrganization } from '../../../test/factories/organization.factory.js';
import { createProjectMember } from '../../../test/factories/project-member.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createTicket } from '../../../test/factories/ticket.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { ApiModule } from '../../api.module.js';
import type { Project } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';

type Who = 'admin' | 'developer' | 'end_user';

describe('ticket list (S1-13)', () => {
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

  async function signIn(who: Who, projects: Project[] = []) {
    const user = await createUser(prisma, {
      keycloakUserId: randomUUID(),
      kind: who === 'end_user' ? 'end_user' : 'team',
      isAdmin: who === 'admin',
    });
    for (const project of projects) {
      await createProjectMember(prisma, {
        projectId: project.id,
        userId: user.id,
        role: who === 'end_user' ? 'end_user' : 'developer',
      });
    }
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: who === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
    });
    return { user, authorization: `Bearer ${token}` };
  }

  function list(authorization: string, query: Record<string, unknown>) {
    return http().get('/api/v1/tickets').query(query).set('Authorization', authorization);
  }

  /** Every page of a list, read with a small limit so that equal sort values cross pages. */
  async function listAll(authorization: string, query: Record<string, unknown>) {
    const items: TicketListItem[] = [];
    let cursor: string | null = null;
    do {
      const res = await list(authorization, { ...query, limit: 2, ...(cursor ? { cursor } : {}) });
      expect(res.status).toBe(200);
      const page = res.body as TicketPage;
      items.push(...(page.items as TicketListItem[]));
      cursor = page.nextCursor;
    } while (cursor !== null);
    return items;
  }

  /** A project with a developer and five tickets with known fields. */
  async function seed() {
    const project = await createProject(prisma);
    const { user, authorization } = await signIn('developer', [project]);
    const colleague = await createUser(prisma, { kind: 'team' });
    await createProjectMember(prisma, {
      projectId: project.id,
      userId: colleague.id,
      role: 'developer',
    });
    const organization = await createOrganization(prisma);
    const ticket = (fields: Parameters<typeof createTicket>[1]) => createTicket(prisma, fields);
    const requesterId = user.id;
    const a = await ticket({
      projectId: project.id,
      requesterId,
      priority: 'high',
      status: 'new',
      type: null,
      source: 'user',
      assigneeId: user.id,
    });
    const b = await ticket({
      projectId: project.id,
      requesterId,
      priority: 'high',
      status: 'todo',
      type: 'bug',
      organizationId: organization.id,
    });
    const c = await ticket({
      projectId: project.id,
      requesterId,
      priority: 'critical',
      status: 'in_progress',
      type: 'feature',
      assigneeId: colleague.id,
    });
    const d = await ticket({
      projectId: project.id,
      requesterId,
      priority: 'low',
      status: 'done',
      type: 'task',
      source: 'user',
      sharingRequest: 'pending',
      visibility: 'only_me',
    });
    const e = await ticket({
      projectId: project.id,
      requesterId,
      priority: 'normal',
      status: 'triage',
      type: 'question',
      assigneeId: user.id,
    });
    return { project, user, colleague, organization, authorization, tickets: { a, b, c, d, e } };
  }

  const ids = (items: { id: string }[]) => items.map(({ id }) => id).sort();

  it('filters by every filter, OR within one and AND across them (§8.1)', async () => {
    const { project, colleague, organization, authorization, tickets } = await seed();
    const { a, b, c, d, e } = tickets;
    const cases: [Record<string, unknown>, string[]][] = [
      [{ status: ['new', 'triage'] }, [a.id, e.id]],
      [{ priority: 'high' }, [a.id, b.id]],
      [{ type: 'none' }, [a.id]],
      [{ type: ['none', 'bug'] }, [a.id, b.id]],
      [{ assigneeId: 'me' }, [a.id, e.id]],
      [{ assigneeId: 'none' }, [b.id, d.id]],
      [{ assigneeId: [colleague.id, 'none'] }, [b.id, c.id, d.id]],
      [{ source: 'user' }, [a.id, d.id]],
      [{ organizationId: organization.id }, [b.id]],
      [{ organizationId: 'none' }, [a.id, c.id, d.id, e.id]],
      [{ sharingRequest: 'pending' }, [d.id]],
      [{ assigneeId: 'me', status: 'new' }, [a.id]],
    ];
    for (const [filters, expected] of cases) {
      const items = await listAll(authorization, {
        projectId: project.id,
        sort: 'updatedAt',
        ...filters,
      });
      expect(ids(items), JSON.stringify(filters)).toEqual([...expected].sort());
    }
  });

  it('sorts by every key with stable pages across equal values (Q8)', async () => {
    const { project, authorization, tickets } = await seed();
    const { a, b, c, d, e } = tickets;
    // b is updated after a, so it comes first among the two high tickets.
    await prisma.ticket.update({ where: { id: b.id }, data: { title: 'Updated later' } });
    const order = async (query: Record<string, unknown>) =>
      (await listAll(authorization, { projectId: project.id, ...query })).map(({ id }) => id);

    expect(await order({ sort: 'priority' })).toEqual([c.id, b.id, a.id, e.id, d.id]);
    expect(await order({ sort: 'priority', order: 'asc' })).toEqual([d.id, e.id, b.id, a.id, c.id]);
    expect(await order({ sort: 'status', order: 'asc' })).toEqual([a.id, e.id, b.id, c.id, d.id]);
    expect(await order({ sort: 'identifier', order: 'asc' })).toEqual([
      a.id,
      b.id,
      c.id,
      d.id,
      e.id,
    ]);
    expect(await order({ sort: 'createdAt' })).toEqual([e.id, d.id, c.id, b.id, a.id]);
    expect((await order({ sort: 'updatedAt' }))[0]).toBe(b.id);
  });

  it('keeps the number order without sort and returns items without the description (Q10)', async () => {
    const { project, authorization, tickets } = await seed();
    const res = await list(authorization, { projectId: project.id });

    expect(res.status).toBe(200);
    const page = res.body as TicketPage;
    expect(page.items.map(({ id }) => id)).toEqual(
      [tickets.e, tickets.d, tickets.c, tickets.b, tickets.a].map(({ id }) => id),
    );
    expect(page.items[0]).not.toHaveProperty('description');
    expect(page.items[0]?.identifier).toBe(`${project.key}-5`);
    expect(page.items[0]?.allowedActions).toContain('read');
  });

  it('matches nothing for a project the principal cannot see and never widens the list (Q5)', async () => {
    const { project, authorization, tickets } = await seed();
    const hidden = await createProject(prisma);
    await createTicket(prisma, { projectId: hidden.id, requesterId: tickets.a.requesterId });

    expect((await listAll(authorization, { projectId: hidden.id, sort: 'priority' })).length).toBe(
      0,
    );
    expect(
      ids(await listAll(authorization, { projectId: [hidden.id, project.id], sort: 'priority' })),
    ).toEqual(ids(Object.values(tickets)));
    expect(
      (
        await listAll(authorization, {
          projectId: project.id,
          assigneeId: randomUUID(),
          sort: 'priority',
        })
      ).length,
    ).toBe(0);
  });

  it('rejects a cursor of another order and order without sort with 422', async () => {
    const { project, authorization } = await seed();
    const first = await list(authorization, { projectId: project.id, sort: 'priority', limit: 1 });
    const cursor = (first.body as TicketPage).nextCursor;

    const res = await list(authorization, { projectId: project.id, sort: 'status', cursor });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ errors: [{ pointer: '/cursor', code: 'field.invalid' }] });

    const noSort = await list(authorization, { order: 'asc' });
    expect(noSort.status).toBe(422);
    expect(noSort.body).toMatchObject({ errors: [{ pointer: '/order' }] });
  });

  it('answers an end user sending a parameter of the team with 422 field.unrecognized (Q21)', async () => {
    const project = await createProject(prisma);
    const { authorization } = await signIn('end_user', [project]);

    const res = await list(authorization, { status: 'new', sort: 'priority' });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'request.validation_failed',
      errors: [
        { pointer: '/status', code: 'field.unrecognized' },
        { pointer: '/sort', code: 'field.unrecognized' },
      ],
    });
    expect((await list(authorization, { projectId: project.id })).status).toBe(200);
    expect((await list(authorization, { involvement: 'mine' })).status).toBe(200);
  });

  describe('organizations for the filter (Q6)', () => {
    async function names(authorization: string) {
      const res = await http()
        .get('/api/v1/organizations')
        .query({ limit: 100 })
        .set('Authorization', authorization);
      return res;
    }

    it("lists to a team member only the names of their projects' organizations", async () => {
      const project = await createProject(prisma);
      const other = await createProject(prisma);
      const mine = await createOrganization(prisma);
      const foreign = await createOrganization(prisma);
      await prisma.organizationProject.create({
        data: { organizationId: mine.id, projectId: project.id },
      });
      await prisma.organizationProject.create({
        data: { organizationId: foreign.id, projectId: other.id },
      });
      const { authorization } = await signIn('developer', [project]);

      const res = await names(authorization);
      expect(res.status).toBe(200);
      const page = res.body as OrganizationPage;
      expect(page.items).toEqual([{ id: mine.id, name: mine.name }]);
    });

    it('lists the full summary to the Administrator and nothing to an end user', async () => {
      const organization = await createOrganization(prisma);
      const admin = await signIn('admin');
      const adminPage = (await names(admin.authorization)).body as OrganizationPage;
      expect(adminPage.items.length).toBeGreaterThan(0);
      expect(adminPage.items[0]).toHaveProperty('domains');

      const endUser = await signIn('end_user');
      expect((await names(endUser.authorization)).status).toBe(404);
      expect(adminPage.items.every((item) => 'domains' in item)).toBe(true);
      expect(organization.name).not.toBe('');
    });

    it('tells team accounts that organizations exist, never end users', async () => {
      await createOrganization(prisma);
      const me = (authorization: string) =>
        http().get('/api/v1/users/me').set('Authorization', authorization);

      const team = await signIn('developer');
      expect(((await me(team.authorization)).body as CurrentUser).organizationsExist).toBe(true);
      const endUser = await signIn('end_user');
      expect(((await me(endUser.authorization)).body as CurrentUser).organizationsExist).toBe(
        false,
      );
    });
  });

  it('keeps a user who is not a member out of the list', async () => {
    const { project } = await seed();
    const { authorization } = await signIn('developer');
    expect((await listAll(authorization, { projectId: project.id, sort: 'priority' })).length).toBe(
      0,
    );
  });
});
