// Ticket visibility end to end (S1-11, §5.1–§5.4, §7.3): the read rules against the current
// organization and project access, and a list that never returns a ticket whose detail is `404`
// – over the demo dataset, in a database of its own.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TimelinePage } from '@trybun/contracts/comments';
import type { TicketPage } from '@trybun/contracts/tickets';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDemoDataset, seedDemoData } from '../../../prisma/demo-dataset.js';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createAttachment } from '../../../test/factories/attachment.factory.js';
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

describe('identities of other customers (§5.4, Q9)', () => {
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

  it('shows the requester, their actions and their files to colleagues and to the team, and Customer to others', async () => {
    const project = await createProject(prisma);
    const [organization, otherOrganization] = [
      await createOrganization(prisma),
      await createOrganization(prisma),
    ];
    await prisma.organizationProject.createMany({
      data: [organization, otherOrganization].map(({ id }) => ({
        organizationId: id,
        projectId: project.id,
      })),
    });
    const user = () => createUser(prisma, { keycloakUserId: randomUUID() });
    const [author, colleague, stranger] = [await user(), await user(), await user()];
    await prisma.organizationMember.createMany({
      data: [
        { organizationId: organization.id, userId: author.id },
        { organizationId: organization.id, userId: colleague.id },
        { organizationId: otherOrganization.id, userId: stranger.id },
      ],
    });
    const developer = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'team' });
    await createProjectMember(prisma, {
      projectId: project.id,
      userId: developer.id,
      role: 'developer',
    });
    const ticket = await createTicket(prisma, {
      projectId: project.id,
      requesterId: author.id,
      organizationId: organization.id,
      source: 'user',
      status: 'new',
      type: null,
      visibility: 'all_customers',
    });
    // A file of the author and one of the team.
    await createAttachment(prisma, {
      uploadedById: author.id,
      ticketId: ticket.id,
      status: 'available',
    });
    await createAttachment(prisma, {
      uploadedById: developer.id,
      ticketId: ticket.id,
      status: 'available',
    });
    // A public event by the author and one by the team.
    await prisma.activityEvent.createMany({
      data: [
        {
          ticketId: ticket.id,
          type: 'attachment_added',
          data: { from: null, to: { id: randomUUID(), displayName: 'log.txt' } },
          actorId: author.id,
          isPublic: true,
        },
        {
          ticketId: ticket.id,
          type: 'sharing_approved',
          data: { from: 'my_organization', to: 'all_customers' },
          actorId: developer.id,
          isPublic: true,
        },
      ],
    });
    const view = async (reader: User) => {
      const authorization = await authorizationOf(config, reader);
      const detail = await http()
        .get(`/api/v1/tickets/${ticket.id}`)
        .set('Authorization', authorization);
      const events = await http()
        .get(`/api/v1/tickets/${ticket.id}/activity-events`)
        .set('Authorization', authorization);
      const files = await http()
        .get(`/api/v1/tickets/${ticket.id}/attachments`)
        .set('Authorization', authorization);
      const actors = (events.body as { items: { actor: { id: string } | null }[] }).items.map(
        ({ actor }) => actor?.id ?? null,
      );
      const uploaders = (
        files.body as { items: { uploadedBy: { id: string; displayName: string | null } | null }[] }
      ).items.map(({ uploadedBy }) => uploadedBy);
      return {
        requester: (detail.body as { requester: { id: string } | null }).requester,
        actors,
        uploaders,
      };
    };
    const authorPerson = { id: author.id, displayName: author.displayName };
    const developerPerson = { id: developer.id, displayName: developer.displayName };

    expect(await view(colleague)).toEqual({
      requester: authorPerson,
      actors: [author.id, developer.id],
      uploaders: [authorPerson, developerPerson],
    });
    expect(await view(stranger)).toEqual({
      requester: null,
      actors: [null, developer.id],
      uploaders: [null, developerPerson],
    });
    expect(await view(developer)).toMatchObject({
      requester: authorPerson,
      uploaders: [authorPerson, developerPerson],
    });
  });
});

describe('changing the visibility and deciding sharing requests (§5.2, §5.3)', () => {
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

  /** A project of an organization, its requester and a Developer, and a ticket of the requester. */
  async function setUp(ticket: Partial<Parameters<typeof createTicket>[1]> = {}) {
    const project = await createProject(prisma);
    const organization = await createOrganization(prisma);
    await prisma.organizationProject.create({
      data: { organizationId: organization.id, projectId: project.id },
    });
    const requester = await createUser(prisma, { keycloakUserId: randomUUID() });
    await prisma.organizationMember.create({
      data: { organizationId: organization.id, userId: requester.id },
    });
    const developer = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'team' });
    await createProjectMember(prisma, {
      projectId: project.id,
      userId: developer.id,
      role: 'developer',
    });
    const row = await createTicket(prisma, {
      projectId: project.id,
      requesterId: requester.id,
      organizationId: organization.id,
      source: 'user',
      status: 'new',
      type: null,
      ...ticket,
    });
    return { project, organization, requester, developer, ticket: row };
  }

  async function send(
    user: User,
    ticket: { id: string; version: number },
    path: 'visibility' | 'sharing/approve' | 'sharing/reject',
    body?: object,
  ) {
    const req =
      path === 'visibility'
        ? http().put(`/api/v1/tickets/${ticket.id}/visibility`)
        : http().post(`/api/v1/tickets/${ticket.id}/${path}`);
    return req
      .set('Authorization', await authorizationOf(config, user))
      .set('If-Match', `W/"${ticket.version}"`)
      .send(body);
  }

  const stored = (id: string) =>
    prisma.ticket.findUniqueOrThrow({
      where: { id },
      select: { visibility: true, sharingRequest: true, version: true },
    });
  const eventsOf = (ticketId: string) =>
    prisma.activityEvent.findMany({
      where: { ticketId },
      select: { type: true, data: true, isPublic: true, actorId: true },
      orderBy: { id: 'asc' },
    });
  const auditOf = (ticketId: string) =>
    prisma.auditLogEntry.findMany({
      where: { targetType: 'Ticket', targetId: ticketId },
      select: { action: true, details: true, actorId: true },
      orderBy: { id: 'asc' },
    });

  it('widens a request of a person in the organization to my_organization while pending (Q4)', async () => {
    const { requester, ticket } = await setUp();

    const res = await send(requester, ticket, 'visibility', { visibility: 'all_customers' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ visibility: 'my_organization', sharingRequest: 'pending' });
    expect(await eventsOf(ticket.id)).toEqual([
      {
        type: 'sharing_requested',
        data: { from: 'only_me', to: 'my_organization' },
        isPublic: false,
        actorId: requester.id,
      },
    ]);
    // Changes by the author are not administrative actions (Q17).
    expect(await auditOf(ticket.id)).toEqual([]);
  });

  it('keeps only_me while pending for a person without an organization', async () => {
    const { project } = await setUp();
    const loner = await createUser(prisma, { keycloakUserId: randomUUID() });
    await createProjectMember(prisma, {
      projectId: project.id,
      userId: loner.id,
      role: 'end_user',
    });
    const ticket = await createTicket(prisma, {
      projectId: project.id,
      requesterId: loner.id,
      source: 'user',
      status: 'new',
      type: null,
    });

    const res = await send(loner, ticket, 'visibility', { visibility: 'all_customers' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ visibility: 'only_me', sharingRequest: 'pending' });
  });

  it('lets the requester withdraw a pending request (Q5)', async () => {
    const { requester, ticket } = await setUp({
      visibility: 'my_organization',
      sharingRequest: 'pending',
    });

    const res = await send(requester, ticket, 'visibility', { visibility: 'my_organization' });

    expect(res.status).toBe(200);
    expect(await stored(ticket.id)).toMatchObject({
      visibility: 'my_organization',
      sharingRequest: 'none',
      version: ticket.version + 1,
    });
    expect((await eventsOf(ticket.id)).map(({ type }) => type)).toEqual([
      'sharing_request_withdrawn',
    ]);
  });

  it('shares an approved request with one public event and an audit entry', async () => {
    const { developer, ticket } = await setUp({
      visibility: 'my_organization',
      sharingRequest: 'pending',
    });

    const res = await send(developer, ticket, 'sharing/approve');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ visibility: 'all_customers', sharingRequest: 'none' });
    expect(await eventsOf(ticket.id)).toEqual([
      {
        type: 'sharing_approved',
        data: { from: 'my_organization', to: 'all_customers' },
        isPublic: true,
        actorId: developer.id,
      },
    ]);
    expect(await auditOf(ticket.id)).toEqual([
      { action: 'ticket.sharing_approved', details: null, actorId: developer.id },
    ]);
  });

  it('refuses a request, keeps the visibility and publishes the reason as a comment (S1-12)', async () => {
    const { developer, requester, organization, ticket } = await setUp({
      visibility: 'my_organization',
      sharingRequest: 'pending',
    });

    expect((await send(developer, ticket, 'sharing/reject', { reason: ' ' })).status).toBe(422);
    const res = await send(developer, ticket, 'sharing/reject', {
      reason: 'The description names a customer.',
    });

    expect(res.status).toBe(200);
    expect(await stored(ticket.id)).toMatchObject({
      visibility: 'my_organization',
      sharingRequest: 'rejected',
    });
    expect(res.body).not.toHaveProperty('sharingRefusalReason');
    // The author sees the reason as a public comment of the refusing team member (Q14).
    const comments = await http()
      .get(`/api/v1/tickets/${ticket.id}/comments`)
      .set('Authorization', await authorizationOf(config, requester));
    expect(comments.body).toMatchObject({
      items: [{ body: 'The description names a customer.', author: { id: developer.id } }],
    });
    expect(await prisma.comment.findFirstOrThrow({ where: { ticketId: ticket.id } })).toMatchObject(
      { audience: 'my_organization', audienceOrganizationId: organization.id },
    );
    expect(await eventsOf(ticket.id)).toEqual([
      { type: 'sharing_rejected', data: null, isPublic: false, actorId: developer.id },
    ]);
    expect((await auditOf(ticket.id)).map(({ action }) => action)).toEqual([
      'ticket.sharing_rejected',
    ]);
  });

  it('records the team’s visibility change in the audit log', async () => {
    const { developer, ticket } = await setUp({ visibility: 'all_customers' });

    const res = await send(developer, ticket, 'visibility', { visibility: 'only_me' });

    expect(res.status).toBe(200);
    expect(await auditOf(ticket.id)).toEqual([
      {
        action: 'ticket.visibility_changed',
        details: { from: 'all_customers', to: 'only_me' },
        actorId: developer.id,
      },
    ]);
  });

  it.each([
    [
      'shares an only_me ticket',
      {},
      'visibility',
      { visibility: 'all_customers' },
      'ticket.author_consent_required',
    ],
    [
      'changes a ticket with a pending request',
      { visibility: 'my_organization' as const, sharingRequest: 'pending' as const },
      'visibility',
      { visibility: 'only_me' },
      'ticket.sharing_pending',
    ],
    ['approves without a request', {}, 'sharing/approve', undefined, 'ticket.sharing_not_pending'],
  ] as const)(
    'answers the team that %s with 409',
    async (_case, ticketFields, path, body, code) => {
      const { developer, ticket } = await setUp(ticketFields);

      const res = await send(developer, ticket, path, body);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code });
    },
  );

  it('refuses my_organization by the team after the requester left the organization (Q4)', async () => {
    const { developer, requester, ticket } = await setUp();
    await prisma.organizationMember.delete({ where: { userId: requester.id } });

    const res = await send(developer, ticket, 'visibility', { visibility: 'my_organization' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'ticket.organization_changed' });
  });

  it('refuses an end user narrowing a shared ticket (§5.3)', async () => {
    const { requester, ticket } = await setUp({ visibility: 'all_customers' });

    const res = await send(requester, ticket, 'visibility', { visibility: 'only_me' });

    expect(res.status).toBe(403);
  });

  it('changes nothing for the current value, after checking the version (Q12)', async () => {
    const { developer, ticket } = await setUp({ visibility: 'my_organization' });

    const stale = await send(developer, { ...ticket, version: ticket.version + 5 }, 'visibility', {
      visibility: 'my_organization',
    });
    const res = await send(developer, ticket, 'visibility', { visibility: 'my_organization' });

    expect(stale.status).toBe(412);
    expect(res.status).toBe(200);
    expect(await stored(ticket.id)).toMatchObject({ version: ticket.version });
    expect(await eventsOf(ticket.id)).toEqual([]);
  });

  it('lets only the first of two concurrent decisions apply', async () => {
    const { project, developer, ticket } = await setUp({
      visibility: 'my_organization',
      sharingRequest: 'pending',
    });
    const colleague = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'team' });
    await createProjectMember(prisma, {
      projectId: project.id,
      userId: colleague.id,
      role: 'developer',
    });

    const results = await Promise.all([
      send(developer, ticket, 'sharing/approve'),
      send(colleague, ticket, 'sharing/reject', { reason: 'No.' }),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([200, 409]);
    const loser = results.find(({ status }) => status === 409);
    expect(loser?.body).toMatchObject({ code: 'ticket.sharing_not_pending' });
    expect(await eventsOf(ticket.id)).toHaveLength(1);
  });
});

describe('creating a ticket with a visibility (S1-11 Q7, Q19)', () => {
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

  /**
   * A project, a member of an organization with access to it, an end user of personal access
   * without an organization, and a Developer.
   */
  async function setUp() {
    const project = await createProject(prisma);
    const organization = await createOrganization(prisma);
    await prisma.organizationProject.create({
      data: { organizationId: organization.id, projectId: project.id },
    });
    const member = await createUser(prisma, { keycloakUserId: randomUUID() });
    await prisma.organizationMember.create({
      data: { organizationId: organization.id, userId: member.id },
    });
    const personal = await createUser(prisma, { keycloakUserId: randomUUID() });
    await createProjectMember(prisma, {
      projectId: project.id,
      userId: personal.id,
      role: 'end_user',
    });
    const developer = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'team' });
    await createProjectMember(prisma, {
      projectId: project.id,
      userId: developer.id,
      role: 'developer',
    });
    return { project, organization, member, personal, developer };
  }

  async function create(user: User, projectId: string, visibility?: string) {
    return http()
      .post('/api/v1/tickets')
      .set('Authorization', await authorizationOf(config, user))
      .send({
        projectId,
        title: 'Invoice missing',
        ...(visibility === undefined ? {} : { visibility }),
      });
  }

  async function projectActions(user: User, projectId: string) {
    const res = await http()
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', await authorizationOf(config, user));
    return (res.body as { allowedActions: string[] }).allowedActions;
  }

  it.each([
    [undefined, 'only_me', 'none'],
    ['my_organization', 'my_organization', 'none'],
    ['all_customers', 'my_organization', 'pending'],
  ] as const)(
    'creates the ticket of an organization member with %s as %s / %s',
    async (requested, visibility, sharingRequest) => {
      const { project, member } = await setUp();

      const res = await create(member, project.id, requested);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ visibility, sharingRequest });
      // Creation writes no activity event (S1-05 Q11).
      expect(
        await prisma.activityEvent.count({ where: { ticketId: (res.body as { id: string }).id } }),
      ).toBe(0);
    },
  );

  it('offers a person without an organization no my_organization, and refuses it with nothing created', async () => {
    const { project, personal } = await setUp();

    expect(await projectActions(personal, project.id)).toEqual([
      'read',
      'create_ticket',
      'create_ticket_all_customers',
    ]);
    const refused = await create(personal, project.id, 'my_organization');
    const pending = await create(personal, project.id, 'all_customers');

    expect(refused.status).toBe(403);
    expect(await prisma.ticket.count({ where: { projectId: project.id } })).toBe(1);
    expect(pending.status).toBe(201);
    expect(pending.body).toMatchObject({ visibility: 'only_me', sharingRequest: 'pending' });
  });

  it('offers a member my_organization only where their organization has access to the project', async () => {
    const { project, member } = await setUp();
    const personalProject = await createProject(prisma);
    await createProjectMember(prisma, {
      projectId: personalProject.id,
      userId: member.id,
      role: 'end_user',
    });

    expect(await projectActions(member, project.id)).toContain('create_ticket_my_organization');
    expect(await projectActions(member, personalProject.id)).not.toContain(
      'create_ticket_my_organization',
    );
    expect((await create(member, personalProject.id, 'my_organization')).status).toBe(403);
  });

  it('refuses my_organization when the organization is archived while the ticket is created (Q4)', async () => {
    const { project, organization, member } = await setUp();

    let creation: Promise<request.Response> | undefined;
    await prisma.$transaction(
      async (tx) => {
        // The archive holds the organization row: the creation has read the project with the
        // organization still active and waits for the share lock of its snapshot.
        await tx.organization.update({
          where: { id: organization.id },
          data: { state: 'archived', version: { increment: 1 } },
        });
        const [{ pid }] = await tx.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() AS pid`;
        creation = create(member, project.id, 'my_organization').then((res) => res);
        // Only a connection this transaction blocks: other test files run in parallel.
        await vi.waitFor(
          async () => {
            const [waiting] = await prisma.$queryRaw<[{ count: bigint }]>`
              SELECT count(*) FROM pg_stat_activity
              WHERE datname = current_database() AND ${pid}::int = ANY(pg_blocking_pids(pid))
                AND query LIKE '%FOR SHARE%'`;
            expect(waiting.count).toBeGreaterThanOrEqual(1n);
          },
          { timeout: 5000, interval: 20 },
        );
      },
      { timeout: 10_000 },
    );
    const res = await (creation as Promise<request.Response>);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'ticket.organization_changed' });
    expect(await prisma.ticket.count({ where: { projectId: project.id } })).toBe(0);
  });

  it('creates team tickets only_me and refuses another visibility (Q6)', async () => {
    const { project, developer } = await setUp();

    expect(await projectActions(developer, project.id)).not.toContain(
      'create_ticket_all_customers',
    );
    expect((await create(developer, project.id, 'all_customers')).status).toBe(403);
    const created = await create(developer, project.id, 'only_me');
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ visibility: 'only_me', sharingRequest: 'none' });
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

  // S1-12: no end-user list of comments or timeline returns a comment whose detail is `404`, and
  // every comment a detail returns is in the list of its ticket.
  it('lists a comment for every principal exactly when its detail is 200, else 404', async () => {
    const dataset = buildDemoDataset();
    expect(dataset.comments.length).toBeGreaterThan(3);
    const principals = await prisma.user.findMany({
      where: { state: 'active', kind: 'end_user' },
    });
    const http = request(app.getHttpServer());
    for (const principal of principals) {
      const authorization = await authorizationOf(config, principal);
      for (const ticketId of new Set(dataset.comments.map(({ ticketId }) => ticketId))) {
        const list = await http
          .get(`/api/v1/tickets/${ticketId}/timeline`)
          .set('Authorization', authorization);
        const listed = new Set(
          list.status === 200
            ? (list.body as TimelinePage).items.flatMap((item) =>
                item.type === 'comment' ? [item.comment.id] : [],
              )
            : [],
        );
        for (const comment of dataset.comments.filter((row) => row.ticketId === ticketId)) {
          const res = await http
            .get(`/api/v1/comments/${comment.id ?? ''}`)
            .set('Authorization', authorization);
          expect(res.status, `${principal.email} ${comment.id ?? ''}`).toBe(
            listed.has(comment.id ?? '') ? 200 : 404,
          );
          if (comment.kind === 'internal') {
            expect(res.status).toBe(404);
          }
        }
      }
    }
  }, 120_000);
});
