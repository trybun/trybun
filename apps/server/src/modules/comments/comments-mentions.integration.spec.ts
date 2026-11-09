// Mentions end to end (S1-12, §6.1, §7.3, Q2, Q4, Q20): the scope per kind and author, the
// limit, the suggestions, and the hidden people a reader sees as @{customer}.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CommentResponse, MentionCandidatePage } from '@trybun/contracts/comments';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createComment } from '../../../test/factories/comment.factory.js';
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

async function authorizationOf(config: TrybunConfig, user: User): Promise<string> {
  const token = await signAccessToken(config, {
    sub: user.keycloakUserId ?? '',
    amr: user.kind === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
  });
  return `Bearer ${token}`;
}

describe('mentions', () => {
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
  const as = (user: User) => authorizationOf(config, user);
  const post = async (user: User, ticketId: string, body: object) =>
    http()
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', await as(user))
      .send(body);
  const candidates = async (user: User, ticketId: string, body: object) =>
    http()
      .post(`/api/v1/tickets/${ticketId}/mention-candidates`)
      .set('Authorization', await as(user))
      .send(body);
  const token = (user: { id: string }) => `@{${user.id}}`;

  /**
   * A project of organizations A and B: the requester and a colleague in A, a stranger in B, the
   * assignee and another Developer who has not taken part, on a `my_organization` ticket of A.
   */
  async function setUp(visibility: 'my_organization' | 'all_customers' = 'my_organization') {
    const project = await createProject(prisma);
    const [organizationA, organizationB] = [
      await createOrganization(prisma),
      await createOrganization(prisma),
    ];
    await prisma.organizationProject.createMany({
      data: [organizationA, organizationB].map(({ id }) => ({
        organizationId: id,
        projectId: project.id,
      })),
    });
    const team = async () => {
      const user = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'team' });
      await createProjectMember(prisma, { projectId: project.id, userId: user.id });
      return user;
    };
    const [assignee, bystander] = [await team(), await team()];
    const customer = () => createUser(prisma, { keycloakUserId: randomUUID(), kind: 'end_user' });
    const [requester, colleague, stranger] = [await customer(), await customer(), await customer()];
    await prisma.organizationMember.createMany({
      data: [
        { organizationId: organizationA.id, userId: requester.id },
        { organizationId: organizationA.id, userId: colleague.id },
        { organizationId: organizationB.id, userId: stranger.id },
      ],
    });
    const ticket = await createTicket(prisma, {
      projectId: project.id,
      requesterId: requester.id,
      organizationId: organizationA.id,
      assigneeId: assignee.id,
      source: 'user',
      status: 'new',
      type: null,
      visibility,
    });
    return { organizationB, assignee, bystander, requester, colleague, stranger, ticket };
  }

  it('stores the mentions of a team comment and maps their names (Q2)', async () => {
    const { assignee, requester, colleague, ticket } = await setUp();

    const res = await post(assignee, ticket.id, {
      kind: 'public',
      body: `Hi ${token(requester)} and ${token(colleague)}, see \`${token(assignee)}\``,
    });

    expect(res.status).toBe(201);
    expect((res.body as CommentResponse).mentions).toEqual([
      { id: requester.id, displayName: requester.displayName },
      { id: colleague.id, displayName: colleague.displayName },
    ]);
    expect(
      await prisma.commentMention.count({ where: { commentId: (res.body as CommentResponse).id } }),
    ).toBe(2);
  });

  it.each([
    ['a customer of another organization', 'stranger'],
    ['an unknown ID', 'unknown'],
  ] as const)('refuses a mention of %s with 422 at /body', async (_case, who) => {
    const fixtures = await setUp();
    const target = who === 'unknown' ? { id: randomUUID() } : fixtures.stranger;

    const res = await post(fixtures.assignee, fixtures.ticket.id, {
      kind: 'public',
      body: `Hello ${token(target)}`,
    });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'comment.mention_not_allowed',
      errors: [{ pointer: '/body', code: 'field.invalid' }],
    });
  });

  it('lets an internal note mention team members only (Q4)', async () => {
    const { assignee, bystander, requester, ticket } = await setUp();

    expect(
      (await post(assignee, ticket.id, { kind: 'internal', body: `cc ${token(bystander)}` }))
        .status,
    ).toBe(201);
    expect(
      (await post(assignee, ticket.id, { kind: 'internal', body: `cc ${token(requester)}` }))
        .status,
    ).toBe(422);
  });

  it('lets an end user mention only the team members who take part in the ticket (Q20)', async () => {
    const { assignee, bystander, requester, colleague, ticket } = await setUp();

    expect(
      (
        await post(requester, ticket.id, {
          kind: 'public',
          body: `${token(assignee)} ${token(colleague)}`,
        })
      ).status,
    ).toBe(201);
    expect(
      (await post(requester, ticket.id, { kind: 'public', body: token(bystander) })).status,
    ).toBe(422);
    // An internal note of the bystander does not make them a participant the requester sees.
    await createComment(prisma, { ticketId: ticket.id, authorId: bystander.id, kind: 'internal' });
    expect(
      (await post(requester, ticket.id, { kind: 'public', body: token(bystander) })).status,
    ).toBe(422);
    await post(bystander, ticket.id, { kind: 'public', body: 'Looking into it' });
    expect(
      (await post(requester, ticket.id, { kind: 'public', body: token(bystander) })).status,
    ).toBe(201);
  });

  it('refuses more than 50 distinct mentions (Q19)', async () => {
    const { assignee, ticket } = await setUp();
    const body = Array.from({ length: 51 }, () => `@{${randomUUID()}}`).join(' ');

    const res = await post(assignee, ticket.id, { kind: 'public', body });

    expect(res.body).toMatchObject({ code: 'comment.too_many_mentions' });
  });

  it('suggests only people who read the ticket and the comment, team first (§7.3)', async () => {
    const { assignee, bystander, requester, colleague, stranger, ticket } = await setUp();

    const asRequester = (await candidates(requester, ticket.id, { kind: 'public', query: '' }))
      .body as MentionCandidatePage;
    const asTeam = (await candidates(assignee, ticket.id, { kind: 'internal', query: '' }))
      .body as MentionCandidatePage;
    const noteAsRequester = await candidates(requester, ticket.id, { kind: 'internal', query: '' });

    const ids = (page: MentionCandidatePage) => page.items.map(({ id }) => id).sort();
    expect(ids(asRequester)).toEqual([assignee.id, requester.id, colleague.id].sort());
    expect(asRequester.items[0]).toMatchObject({ id: assignee.id, userKind: 'team' });
    expect(ids(asRequester)).not.toContain(stranger.id);
    expect(ids(asRequester)).not.toContain(bystander.id);
    expect(ids(asTeam)).toEqual([assignee.id, bystander.id].sort());
    expect(noteAsRequester.status).toBe(403);
  });

  it('filters the suggestions by the query of the display name', async () => {
    const { assignee, requester, ticket } = await setUp();
    await prisma.user.update({ where: { id: requester.id }, data: { displayName: 'Zofia Nowak' } });

    const page = (await candidates(assignee, ticket.id, { kind: 'public', query: 'zofia' }))
      .body as MentionCandidatePage;

    expect(page.items).toEqual([
      { id: requester.id, displayName: 'Zofia Nowak', userKind: 'end_user' },
    ]);
  });

  it('restores a hidden person on an edit and keeps the mention (§5.4)', async () => {
    const { organizationB, requester, colleague, assignee, ticket } = await setUp('all_customers');
    const created = (
      await post(requester, ticket.id, { kind: 'public', body: `Ask ${token(colleague)}` })
    ).body as CommentResponse;
    // The colleague moves to organization B: the requester may no longer see their name.
    await prisma.organizationMember.update({
      where: { userId: colleague.id },
      data: { organizationId: organizationB.id },
    });
    const seen = (
      await http()
        .get(`/api/v1/comments/${created.id}`)
        .set('Authorization', await as(requester))
    ).body as CommentResponse;

    const edited = await http()
      .patch(`/api/v1/comments/${created.id}`)
      .set('Authorization', await as(requester))
      .set('If-Match', 'W/"1"')
      .send({ body: `${seen.body} or ${token(assignee)}` });

    expect(seen.body).toBe('Ask @{customer}');
    expect(edited.status).toBe(200);
    expect(
      await prisma.comment.findUniqueOrThrow({ where: { id: created.id }, select: { body: true } }),
    ).toEqual({ body: `Ask ${token(colleague)} or ${token(assignee)}` });
    expect(
      (await prisma.commentMention.findMany({ where: { commentId: created.id } }))
        .map(({ userId }) => userId)
        .sort(),
    ).toEqual([colleague.id, assignee.id].sort());
  });
});
