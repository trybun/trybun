// Writing comments end to end (S1-12, §4.3, §5.2, §6.1): the audience taken from the locked
// ticket, internal notes of the team, draft attachments and the rules for closed tickets.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Comment, CommentResponse } from '@trybun/contracts/comments';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
import { ApiModule } from '../../api.module.js';
import type { User } from '../../generated/prisma/client.js';
import type { TrybunConfig } from '../../platform/config/config.schema.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';

const DAY_MS = 24 * 60 * 60 * 1000;

async function authorizationOf(config: TrybunConfig, user: User): Promise<string> {
  const token = await signAccessToken(config, {
    sub: user.keycloakUserId ?? '',
    amr: user.kind === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
  });
  return `Bearer ${token}`;
}

// Many requests and sign-ins per case: slower runners need more than the default 5 s.
describe('writing comments', { timeout: 30_000 }, () => {
  const config = integrationConfig();
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiModule.forRoot(config)],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<Server>>();
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
  const post = async (user: User, ticketId: string, body: object) =>
    http()
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', await authorizationOf(config, user))
      .send(body);

  /** A project of an organization with a Developer and a requester of that organization. */
  async function setUp(ticket: Partial<Parameters<typeof createTicket>[1]> = {}) {
    const project = await createProject(prisma);
    const organization = await createOrganization(prisma);
    await prisma.organizationProject.create({
      data: { organizationId: organization.id, projectId: project.id },
    });
    const developer = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'team' });
    await createProjectMember(prisma, { projectId: project.id, userId: developer.id });
    const requester = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'end_user' });
    await prisma.organizationMember.create({
      data: { organizationId: organization.id, userId: requester.id },
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
    return { project, organization, developer, requester, ticket: row };
  }

  it('gives a public comment the visibility of the ticket as its audience (§5.2)', async () => {
    const { organization, developer, requester, ticket } = await setUp({
      visibility: 'my_organization',
    });

    const res = await post(requester, ticket.id, { kind: 'public', body: '  It still fails ' });
    const asTeam = await http()
      .get(`/api/v1/comments/${(res.body as CommentResponse).id}`)
      .set('Authorization', await authorizationOf(config, developer));

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/comments/${(res.body as CommentResponse).id}`);
    expect(res.body).toMatchObject({
      ticketId: ticket.id,
      body: 'It still fails',
      author: { id: requester.id },
      editedAt: null,
      version: 1,
      allowedActions: ['read', 'update', 'delete', 'read_revisions'],
    });
    expect(res.body).not.toHaveProperty('audience');
    expect(asTeam.body).toMatchObject({
      kind: 'public',
      audience: 'my_organization',
      audienceOrganization: { id: organization.id, name: organization.name },
    } satisfies Partial<Comment>);
  });

  it('keeps the ticket unchanged: a comment is a child record (§17.2)', async () => {
    const { developer, ticket } = await setUp();

    await post(developer, ticket.id, { kind: 'internal', body: 'Checked the logs' });

    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({
      version: ticket.version,
      updatedAt: ticket.updatedAt,
    });
  });

  it('lets the team add an internal note without an audience, and no end user (§6.1)', async () => {
    const { developer, requester, ticket } = await setUp();

    const note = await post(developer, ticket.id, { kind: 'internal', body: 'Root cause found' });
    const byRequester = await post(requester, ticket.id, { kind: 'internal', body: 'Hidden?' });

    expect(note.status).toBe(201);
    expect(note.body).toMatchObject({
      kind: 'internal',
      audience: null,
      audienceOrganization: null,
    });
    expect(byRequester.status).toBe(403);
    expect(await prisma.comment.count({ where: { ticketId: ticket.id } })).toBe(1);
  });

  it('links the own drafts to the comment, and refuses another person’s (§13.3)', async () => {
    const { developer, requester, ticket } = await setUp();
    const own = await createAttachment(prisma, { uploadedById: requester.id });
    const foreign = await createAttachment(prisma, { uploadedById: developer.id });

    const res = await post(requester, ticket.id, {
      kind: 'public',
      body: 'Screenshot attached',
      attachmentIds: [own.id],
    });
    const refused = await post(requester, ticket.id, {
      kind: 'public',
      body: 'Not mine',
      attachmentIds: [foreign.id],
    });

    expect(res.status).toBe(201);
    expect((res.body as CommentResponse).attachments).toMatchObject([
      { id: own.id, commentId: (res.body as CommentResponse).id, ticketId: null },
    ]);
    expect(refused.status).toBe(404);
    expect(await prisma.attachment.findUniqueOrThrow({ where: { id: foreign.id } })).toMatchObject({
      commentId: null,
      ticketId: null,
    });
  });

  it.each([
    ['rejected', { status: 'rejected' as const }],
    ['duplicate', { status: 'duplicate' as const }],
    ['done 14 days ago', { status: 'done' as const, closedAt: new Date(Date.now() - 14 * DAY_MS) }],
  ])('refuses an end user’s comment on a %s ticket with 409 (§4.3)', async (_case, ticket) => {
    const { developer, requester, ticket: row } = await setUp(ticket);

    const res = await post(requester, row.id, { kind: 'public', body: 'Hello?' });
    const byTeam = await post(developer, row.id, { kind: 'public', body: 'Closed, sorry' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'ticket.comments_closed' });
    expect(byTeam.status).toBe(201);
  });

  it('accepts an end user’s comment on a ticket done 13 days ago', async () => {
    const { requester, ticket } = await setUp({
      status: 'done',
      closedAt: new Date(Date.now() - 13 * DAY_MS),
    });

    expect((await post(requester, ticket.id, { kind: 'public', body: 'Thanks!' })).status).toBe(
      201,
    );
  });

  it('refuses a comment in an archived project with 409 and hides other tickets (404)', async () => {
    const { project, developer, ticket } = await setUp();
    const other = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'end_user' });
    await prisma.project.update({ where: { id: project.id }, data: { state: 'archived' } });

    const archived = await post(developer, ticket.id, { kind: 'internal', body: 'Late note' });
    const invisible = await post(other, ticket.id, { kind: 'public', body: 'Hi' });

    expect(archived.status).toBe(409);
    expect(archived.body).toMatchObject({ code: 'project.archived' });
    expect(invisible.status).toBe(404);
  });
});
