// Editing comments and descriptions end to end (S1-12, §6.1, §7.5): content revisions, the
// "edited" marker, who reads the history (Q3), optimistic locking and the internal events (Q6).
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CommentResponse } from '@trybun/contracts/comments';
import type { ContentRevisionPage } from '@trybun/contracts/content-revisions';
import type { TicketResponse } from '@trybun/contracts/tickets';
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

describe('editing comments and descriptions', () => {
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
  const as = async (user: User) => authorizationOf(config, user);

  async function setUp() {
    const project = await createProject(prisma);
    const organization = await createOrganization(prisma);
    await prisma.organizationProject.create({
      data: { organizationId: organization.id, projectId: project.id },
    });
    const developer = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'team' });
    await createProjectMember(prisma, { projectId: project.id, userId: developer.id });
    const requester = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'end_user' });
    const colleague = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'end_user' });
    await prisma.organizationMember.createMany({
      data: [
        { organizationId: organization.id, userId: requester.id },
        { organizationId: organization.id, userId: colleague.id },
      ],
    });
    const ticket = await createTicket(prisma, {
      projectId: project.id,
      requesterId: requester.id,
      organizationId: organization.id,
      source: 'user',
      status: 'new',
      type: null,
      visibility: 'my_organization',
      description: 'First version',
    });
    const comment = await createComment(prisma, {
      ticketId: ticket.id,
      authorId: requester.id,
      audience: 'my_organization',
      audienceOrganizationId: organization.id,
      body: 'My phone number is 555-0100',
    });
    return { project, developer, requester, colleague, ticket, comment };
  }

  const editComment = async (user: User, id: string, version: number, body: string) =>
    http()
      .patch(`/api/v1/comments/${id}`)
      .set('Authorization', await as(user))
      .set('If-Match', `W/"${version}"`)
      .send({ body });

  it('keeps the replaced text as a revision and marks the comment edited (§6.1)', async () => {
    const { developer, requester, comment, ticket } = await setUp();

    const res = await editComment(requester, comment.id, 1, 'Call me at the office');
    const history = await http()
      .get(`/api/v1/comments/${comment.id}/revisions`)
      .set('Authorization', await as(requester));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      body: 'Call me at the office',
      version: 2,
      editedAt: expect.any(String) as string,
    } satisfies Partial<CommentResponse>);
    expect(history.body).toEqual({
      items: [
        {
          id: expect.any(String) as string,
          body: 'My phone number is 555-0100',
          mentions: [],
          author: { id: requester.id, displayName: requester.displayName },
          writtenAt: comment.createdAt.toISOString(),
        },
      ],
      nextCursor: null,
    } satisfies ContentRevisionPage);
    const events = await prisma.activityEvent.findMany({ where: { ticketId: ticket.id } });
    expect(events).toMatchObject([
      {
        type: 'comment_edited',
        data: { commentId: comment.id },
        isPublic: false,
        actorId: requester.id,
      },
    ]);
    expect(JSON.stringify(events)).not.toContain('555-0100');
    // The team reads every history (Q3).
    const asTeam = await http()
      .get(`/api/v1/comments/${comment.id}/revisions`)
      .set('Authorization', await as(developer));
    expect(asTeam.status).toBe(200);
  });

  it('shows another end user "edited" but not the earlier versions (§7.5, Q3)', async () => {
    const { requester, colleague, comment } = await setUp();
    await editComment(requester, comment.id, 1, 'Edited');

    const detail = await http()
      .get(`/api/v1/comments/${comment.id}`)
      .set('Authorization', await as(colleague));
    const history = await http()
      .get(`/api/v1/comments/${comment.id}/revisions`)
      .set('Authorization', await as(colleague));

    expect(detail.body).toMatchObject({ editedAt: expect.any(String) as string });
    expect((detail.body as CommentResponse).allowedActions).toEqual(['read']);
    expect(history.status).toBe(403);
  });

  it('refuses another person’s edit with 403, a stale version with 412 and none with 428', async () => {
    const { developer, colleague, requester, comment } = await setUp();

    expect((await editComment(colleague, comment.id, 1, 'Mine now')).status).toBe(403);
    expect((await editComment(developer, comment.id, 1, 'Team edit')).status).toBe(403);
    expect((await editComment(requester, comment.id, 7, 'Late')).status).toBe(412);
    const missing = await http()
      .patch(`/api/v1/comments/${comment.id}`)
      .set('Authorization', await as(requester))
      .send({ body: 'No version' });
    expect(missing.status).toBe(428);
  });

  it('keeps the edited description as a revision readable by the team and the requester', async () => {
    const { developer, requester, colleague, ticket } = await setUp();

    const res = await http()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set('Authorization', await as(requester))
      .set('If-Match', 'W/"1"')
      .send({ description: 'Second version' });
    const read = (user: User) =>
      as(user).then((authorization) =>
        http()
          .get(`/api/v1/tickets/${ticket.id}/description-revisions`)
          .set('Authorization', authorization),
      );

    expect(res.status).toBe(200);
    expect((res.body as TicketResponse).descriptionEditedAt).toEqual(expect.any(String));
    expect((await read(requester)).body).toMatchObject({
      items: [{ body: 'First version', author: { id: requester.id } }],
    });
    expect((await read(developer)).status).toBe(200);
    expect((await read(colleague)).status).toBe(403);
  });

  it('refuses an edit in an archived project with 409, and keeps the history readable', async () => {
    const { project, requester, comment } = await setUp();
    await editComment(requester, comment.id, 1, 'Before archiving');
    await prisma.project.update({ where: { id: project.id }, data: { state: 'archived' } });

    const res = await editComment(requester, comment.id, 2, 'After archiving');
    const history = await http()
      .get(`/api/v1/comments/${comment.id}/revisions`)
      .set('Authorization', await as(requester));

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'project.archived' });
    expect(history.status).toBe(200);
  });
});
