// Ticket visibility end to end (S1-11, §5.1–§5.4, §7.3): the read rules against the current
// organization and project access, and a list that never returns a ticket whose detail is `404`
// – over the demo dataset, in a database of its own.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TicketPage } from '@trybun/contracts/tickets';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildDemoDataset, seedDemoData } from '../../../prisma/demo-dataset.js';
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
import { createOwnDatabase } from '../../../test/setup/own-database.js';
import { ApiModule } from '../../api.module.js';
import type { User } from '../../generated/prisma/client.js';
import type { TrybunConfig } from '../../platform/config/config.schema.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';

async function startApi(config: TrybunConfig) {
  const moduleRef = await Test.createTestingModule({
    imports: [ApiModule.forRoot(config)],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<Server>>();
  app.setGlobalPrefix(API_PREFIX);
  await app.init();
  return app;
}

/** A signed-in account; team accounts with 2FA (§7.4). */
async function authorizationOf(config: TrybunConfig, user: User): Promise<string> {
  const token = await signAccessToken(config, {
    sub: user.keycloakUserId ?? '',
    amr: user.kind === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
  });
  return `Bearer ${token}`;
}

describe('ticket visibility', () => {
  const config = integrationConfig();
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await startApi(config);
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    mswServer.use(keycloakJwksHandler(config));
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  const endUser = (overrides = {}) =>
    createUser(prisma, { keycloakUserId: randomUUID(), kind: 'end_user', ...overrides });

  /** A project of an organization with two of its members, and a requester of another one. */
  async function setUp() {
    const project = await createProject(prisma);
    const organization = await createOrganization(prisma);
    const otherOrganization = await createOrganization(prisma);
    await prisma.organizationProject.createMany({
      data: [
        { organizationId: organization.id, projectId: project.id },
        { organizationId: otherOrganization.id, projectId: project.id },
      ],
    });
    const [author, colleague, stranger] = [await endUser(), await endUser(), await endUser()];
    await prisma.organizationMember.createMany({
      data: [
        { organizationId: organization.id, userId: author.id },
        { organizationId: organization.id, userId: colleague.id },
        { organizationId: otherOrganization.id, userId: stranger.id },
      ],
    });
    const ticketOf = (
      data: Parameters<typeof createTicket>[1] extends infer T ? Partial<T> : never,
    ) =>
      createTicket(prisma, {
        projectId: project.id,
        requesterId: author.id,
        organizationId: organization.id,
        source: 'user',
        status: 'new',
        type: null,
        ...data,
      });
    return { project, organization, otherOrganization, author, colleague, stranger, ticketOf };
  }

  const read = async (user: User, ticketId: string) =>
    (
      await http()
        .get(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', await authorizationOf(config, user))
    ).status;

  it('shows a pending request to the author’s organization only', async () => {
    const { author, colleague, stranger, ticketOf } = await setUp();
    const pending = await ticketOf({ visibility: 'my_organization', sharingRequest: 'pending' });

    expect(await read(author, pending.id)).toBe(200);
    expect(await read(colleague, pending.id)).toBe(200);
    expect(await read(stranger, pending.id)).toBe(404);
  });

  it('shows a shared ticket to every customer of the project', async () => {
    const { colleague, stranger, ticketOf } = await setUp();
    const shared = await ticketOf({ visibility: 'all_customers' });
    const outsider = await endUser();

    expect(await read(colleague, shared.id)).toBe(200);
    expect(await read(stranger, shared.id)).toBe(200);
    expect(await read(outsider, shared.id)).toBe(404);
  });

  it('keeps own only_me tickets and drops my_organization tickets of the old organization after a move (§7.3)', async () => {
    const { author, colleague, otherOrganization, ticketOf } = await setUp();
    const own = await ticketOf({});
    const ownShared = await ticketOf({ visibility: 'all_customers' });
    const ownOrganization = await ticketOf({ visibility: 'my_organization' });
    const colleagueTicket = await ticketOf({
      requesterId: colleague.id,
      visibility: 'my_organization',
    });
    expect(await read(author, colleagueTicket.id)).toBe(200);

    // The move of S1-02: the membership changes, the tickets keep their snapshot.
    await prisma.organizationMember.update({
      where: { userId: author.id },
      data: { organizationId: otherOrganization.id },
    });

    expect(await read(author, own.id)).toBe(200);
    expect(await read(author, ownShared.id)).toBe(200);
    expect(await read(author, ownOrganization.id)).toBe(404);
    expect(await read(author, colleagueTicket.id)).toBe(404);
    // The colleagues of the old organization still see the author's ticket.
    expect(await read(colleague, ownOrganization.id)).toBe(200);
  });

  it('keeps own tickets and hides colleagues’ tickets while the organization is archived (§7.3)', async () => {
    const { organization, author, colleague, ticketOf } = await setUp();
    const own = await ticketOf({ visibility: 'my_organization' });
    const colleagueTicket = await ticketOf({
      requesterId: colleague.id,
      visibility: 'my_organization',
    });

    await prisma.organization.update({
      where: { id: organization.id },
      data: { state: 'archived', version: { increment: 1 } },
    });

    expect(await read(author, own.id)).toBe(200);
    expect(await read(author, colleagueTicket.id)).toBe(404);

    await prisma.organization.update({
      where: { id: organization.id },
      data: { state: 'active', version: { increment: 1 } },
    });

    expect(await read(author, colleagueTicket.id)).toBe(200);
  });

  it('shows colleagues a my_organization ticket only in projects they can open (Q2)', async () => {
    const { organization, author, colleague } = await setUp();
    // A project the author reaches by personal access only.
    const personalProject = await createProject(prisma);
    await createProjectMember(prisma, {
      projectId: personalProject.id,
      userId: author.id,
      role: 'end_user',
    });
    const ticket = await createTicket(prisma, {
      projectId: personalProject.id,
      requesterId: author.id,
      organizationId: organization.id,
      source: 'user',
      status: 'new',
      type: null,
      visibility: 'my_organization',
    });

    expect(await read(author, ticket.id)).toBe(200);
    expect(await read(colleague, ticket.id)).toBe(404);
  });
});

describe('lists equal details over the demo dataset (S1-11 Q13)', () => {
  let config: TrybunConfig;
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  beforeAll(async () => {
    config = { ...integrationConfig(), databaseUrl: await createOwnDatabase() };
    app = await startApi(config);
    prisma = app.get(PrismaService);
    await seedDemoData(prisma);
    // Every account of the dataset signs in here, also those without a Keycloak user.
    for (const user of await prisma.user.findMany({ where: { keycloakUserId: null } })) {
      await prisma.user.update({ where: { id: user.id }, data: { keycloakUserId: randomUUID() } });
    }
  });

  beforeEach(() => {
    mswServer.use(keycloakJwksHandler(config));
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists a ticket for every principal exactly when its detail is 200, else 404', async () => {
    const dataset = buildDemoDataset();
    const ticketIds = dataset.tickets.map(({ id }) => id ?? '');
    const principals = await prisma.user.findMany({
      where: {
        state: 'active',
        OR: [
          { kind: 'end_user' },
          { email: { in: ['admin@example.com', 'manager@example.com', 'developer@example.com'] } },
        ],
      },
    });
    expect(principals.filter(({ kind }) => kind === 'end_user').length).toBeGreaterThan(10);

    const http = request(app.getHttpServer());
    for (const principal of principals) {
      const authorization = await authorizationOf(config, principal);
      const listed = new Set<string>();
      let cursor: string | null = null;
      do {
        const res = await http
          .get('/api/v1/tickets')
          .query({ limit: 100, ...(cursor === null ? {} : { cursor }) })
          .set('Authorization', authorization);
        expect(res.status).toBe(200);
        const page = res.body as TicketPage;
        for (const item of page.items) {
          listed.add(item.id);
        }
        cursor = page.nextCursor;
      } while (cursor !== null);

      for (const ticketId of ticketIds) {
        const res = await http
          .get(`/api/v1/tickets/${ticketId}`)
          .set('Authorization', authorization);
        expect(res.status, `${principal.email} ${ticketId}`).toBe(listed.has(ticketId) ? 200 : 404);
      }
    }
  }, 120_000);
});
