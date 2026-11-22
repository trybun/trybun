import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ORGANIZATION_MAX_PROJECTS, type Organization } from '@trybun/contracts/organizations';
import { DEFAULT_PAGE_LIMIT } from '@trybun/contracts/pagination';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildDemoDataset, seedDemoData } from '../prisma/demo-dataset.js';
import {
  addQaPages,
  buildQaPagesDataset,
  isTestEnvironmentDatabase,
  QA_PAGE_COUNT,
  qaPageId,
  removeQaPages,
} from '../prisma/qa-pages-dataset.js';
import { ApiModule } from '../src/api.module.js';
import { ATTACHMENT_DELETED } from '../src/modules/attachments/attachments.events.js';
import type { TrybunConfig } from '../src/platform/config/config.schema.js';
import { PrismaService } from '../src/platform/database/prisma.service.js';
import { API_PREFIX } from '../src/platform/http/api-prefix.js';
import { keycloakJwksHandler, signAccessToken } from './factories/access-token.factory.js';
import { createAttachment } from './factories/attachment.factory.js';
import { createComment } from './factories/comment.factory.js';
import { createInvitation } from './factories/invitation.factory.js';
import { createProjectMember } from './factories/project-member.factory.js';
import { createDuplicateRelation, createTicket } from './factories/ticket.factory.js';
import { mswServer } from './msw/server.js';
import { integrationConfig } from './setup/config.js';
import { createOwnDatabase } from './setup/own-database.js';

// The QA page records of the QA test environment (#440). A database of its own: "as it was before"
// compares every table, which the parallel tests of the shared database change.
describe('QA page records', () => {
  let config: TrybunConfig;
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  const demo = buildDemoDataset();
  const manager = demo.users.find(({ email }) => email === 'manager@example.com');
  const customer = demo.users.find(({ email }) => email === 'customer@customer.example.com');
  const [demoProject] = demo.projects;
  const [demoTicket] = demo.tickets;
  const qaOrganizationId = qaPageId(101);
  const qaProjectId = qaPageId(201);

  beforeAll(async () => {
    config = { ...integrationConfig(), databaseUrl: await createOwnDatabase() };
    const moduleRef = await Test.createTestingModule({
      imports: [ApiModule.forRoot(config)],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    mswServer.use(keycloakJwksHandler(config));
    await removeQaPages(prisma);
    await seedDemoData(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  /** The access token of a demo account; a team member signed in with 2FA (§7.4). */
  async function signInAs(email: string) {
    const account = demo.users.find((user) => user.email === email);
    expect(account?.keycloakUserId).toBeTruthy();
    const token = await signAccessToken(config, {
      sub: account?.keycloakUserId ?? '',
      amr: account?.kind === 'team' ? ['pwd', 'otp'] : ['pwd'],
    });
    return `Bearer ${token}`;
  }

  async function get(authorization: string, path: string, query: Record<string, string> = {}) {
    const res = await request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .query(query)
      .set('Authorization', authorization);
    expect({ path, status: res.status }).toEqual({ path, status: 200 });
    return res.body as unknown;
  }

  /** Every row of every table but the outbox and `except`, as JSON text in a stable order. */
  async function snapshot(except: string[] = []) {
    const tables = await prisma.$queryRaw<{ name: string }[]>`
      SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('_prisma_migrations', 'outbox_events')
      ORDER BY table_name`;
    const rows: Record<string, string[]> = {};
    for (const { name } of tables.filter((table) => !except.includes(table.name))) {
      // The names come from the catalog above; identifiers cannot be query parameters.
      const result = await prisma.$queryRawUnsafe<{ row: string }[]>(
        `SELECT to_jsonb(t)::text AS row FROM "${name}" t ORDER BY 1`,
      );
      rows[name] = result.map(({ row }) => row);
    }
    return rows;
  }

  it.each([
    ['postgresql://trybun:trybun@localhost:5432/trybun', true],
    ['postgres://trybun@127.0.0.1/trybun', true],
    ['postgresql://trybun@[::1]:5432/trybun', true],
    ['postgresql://trybun@localhost:5433/trybun', false],
    ['postgresql://trybun@db.example.org:5432/trybun', false],
    ['mysql://trybun@localhost:5432/trybun', false],
    ['not a url', false],
  ])('treats %s as the database of the test environment: %s', (url, expected) => {
    expect(isTestEnvironmentDatabase(url)).toBe(expected);
  });

  it('is the same on every build', () => {
    expect(buildQaPagesDataset()).toEqual(buildQaPagesDataset());
  });

  it('gives every list it names a second page for the account the README names', async () => {
    await addQaPages(prisma);
    const administrator = await signInAs('admin@example.com');
    const requester = await signInAs('customer@customer.example.com');
    // The request of each list's first page, as its query in apps/web/src/features/*/queries.ts
    // sends it.
    const lists: [
      list: string,
      authorization: string,
      path: string,
      query?: Record<string, string>,
    ][] = [
      ['Accounts', administrator, '/users'],
      ['Organizations', administrator, '/organizations', { state: 'active' }],
      // Also the picker of the projects of an organization, which loads more of them.
      ['Projects', administrator, '/projects', { state: 'active' }],
      [
        'Members of QA page organization 01',
        administrator,
        `/organizations/${qaOrganizationId}/members`,
      ],
      ['Members of QA page project 01', administrator, `/projects/${qaProjectId}/members`],
      [
        'Organizations of QA page project 01',
        administrator,
        '/organizations',
        { state: 'active', projectId: qaProjectId },
      ],
      // The **Custom filter** view with the project as its only filter, in the list's page size.
      [
        'Ticket list filtered by QA page project 01',
        administrator,
        '/tickets',
        {
          projectId: qaProjectId,
          sort: 'priority',
          order: 'desc',
          limit: String(DEFAULT_PAGE_LIMIT),
        },
      ],
      ['My tickets in the portal', requester, '/tickets', { involvement: 'mine' }],
    ];
    for (const [list, authorization, path, query] of lists) {
      const page = (await get(authorization, path, query)) as {
        items: unknown[];
        nextCursor: string | null;
      };
      expect({ list, items: page.items.length, secondPage: page.nextCursor !== null }).toEqual({
        list,
        items: DEFAULT_PAGE_LIMIT,
        secondPage: true,
      });
    }

    // The Projects of an organization come with it, all of them; **Load more** is that of the
    // picker of the projects to add – the Projects list above – which the section shows while the
    // Administrator may add more (organization-projects.tsx).
    const organization = (await get(
      administrator,
      `/organizations/${qaOrganizationId}`,
    )) as Organization;
    expect({
      projects: organization.projects.length,
      canAdd:
        organization.allowedActions.includes('manage_projects') &&
        organization.projects.length < ORGANIZATION_MAX_PROJECTS,
    }).toEqual({ projects: QA_PAGE_COUNT, canAdd: true });
  });

  it('keeps all but the tickets when a boot restores the demo dataset', async () => {
    await addQaPages(prisma);
    const added = await snapshot(['tickets']);

    await seedDemoData(prisma);

    expect(await snapshot(['tickets'])).toEqual(added);
    expect(await prisma.ticket.count({ where: { projectId: qaProjectId } })).toBe(0);
  });

  it('restores the records when added again', async () => {
    await addQaPages(prisma);
    const added = await snapshot();
    await prisma.organization.update({
      where: { id: qaOrganizationId },
      data: { name: 'Renamed during the QA' },
    });
    await prisma.projectMember.deleteMany({ where: { projectId: qaProjectId } });
    await createTicket(prisma, { projectId: qaProjectId, requesterId: manager?.id ?? '' });

    await addQaPages(prisma);

    expect(await snapshot()).toEqual(added);
  });

  it('leaves the database as it was before, also after records were added to them in the QA', async () => {
    const before = await snapshot();
    await addQaPages(prisma);
    const qaAccountId = qaPageId(1);
    // What a QA session may add to the QA page records.
    const ticket = await createTicket(prisma, {
      projectId: qaProjectId,
      requesterId: manager?.id ?? '',
    });
    const comment = await createComment(prisma, {
      ticketId: ticket.id,
      authorId: manager?.id ?? '',
    });
    const attachment = await createAttachment(prisma, {
      uploadedById: manager?.id ?? '',
      commentId: comment.id,
      status: 'available',
    });
    await createDuplicateRelation(prisma, ticket, { id: demoTicket?.id ?? '' });
    await createProjectMember(prisma, {
      projectId: demoProject?.id ?? '',
      userId: qaAccountId,
      role: 'end_user',
    });
    await createInvitation(prisma, { userId: qaAccountId, invitedById: manager?.id ?? null });

    await removeQaPages(prisma);

    expect(await snapshot()).toEqual(before);
    // The Worker removes the object of the deleted attachment, as after the demo dataset.
    expect(
      await prisma.outboxEvent.count({
        where: { type: ATTACHMENT_DELETED, payload: { equals: { attachmentId: attachment.id } } },
      }),
    ).toBe(1);
  });

  it('changes nothing when a record outside them refers to one of them', async () => {
    await addQaPages(prisma);
    const added = await snapshot();
    // A demo end user moved into a QA page organization creates a ticket in a demo project: the
    // ticket keeps that organization (§3.2).
    await prisma.organizationMember.update({
      where: { userId: customer?.id ?? '' },
      data: { organizationId: qaOrganizationId },
    });
    await createTicket(prisma, {
      projectId: demoProject?.id ?? '',
      source: 'user',
      status: 'new',
      requesterId: customer?.id ?? '',
      organizationId: qaOrganizationId,
    });
    const referred = await snapshot();

    await expect(removeQaPages(prisma)).rejects.toMatchObject({ code: 'P2003' });

    expect(await snapshot()).toEqual(referred);
    expect(referred).not.toEqual(added);
  });
});
