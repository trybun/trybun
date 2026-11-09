// Deleting comments end to end (S1-12, §6.1, §13.5, Q7): the row with its revisions, mentions
// and attachments, the internal event of the team timeline and the audit log.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TimelinePage } from '@trybun/contracts/comments';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createAttachment } from '../../../test/factories/attachment.factory.js';
import { createComment } from '../../../test/factories/comment.factory.js';
import { createContentRevision } from '../../../test/factories/content-revision.factory.js';
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

describe('deleting comments', () => {
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
  const remove = async (user: User, id: string, version = 1) =>
    http()
      .delete(`/api/v1/comments/${id}`)
      .set('Authorization', await as(user))
      .set('If-Match', `W/"${version}"`);

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
    });
    const comment = await createComment(prisma, {
      ticketId: ticket.id,
      authorId: requester.id,
      audience: 'my_organization',
      audienceOrganizationId: organization.id,
    });
    await createContentRevision(prisma, { commentId: comment.id, authorId: requester.id });
    await prisma.commentMention.create({ data: { commentId: comment.id, userId: developer.id } });
    const file = await createAttachment(prisma, {
      uploadedById: requester.id,
      commentId: comment.id,
    });
    return { developer, requester, colleague, ticket, comment, file };
  }

  it('deletes the comment with its revisions, mentions and attachments (§6.1)', async () => {
    const { requester, developer, ticket, comment, file } = await setUp();

    const res = await remove(requester, comment.id);

    expect(res.status).toBe(204);
    expect(await prisma.comment.count({ where: { id: comment.id } })).toBe(0);
    expect(await prisma.contentRevision.count({ where: { commentId: comment.id } })).toBe(0);
    expect(await prisma.commentMention.count({ where: { commentId: comment.id } })).toBe(0);
    expect(await prisma.attachment.count({ where: { id: file.id } })).toBe(0);
    expect(
      await prisma.outboxEvent.findMany({
        where: { type: 'attachment.deleted', payload: { equals: { attachmentId: file.id } } },
      }),
    ).toHaveLength(1);
    expect(await prisma.activityEvent.findMany({ where: { ticketId: ticket.id } })).toMatchObject([
      {
        type: 'comment_deleted',
        data: { commentId: comment.id, kind: 'public' },
        actorId: requester.id,
        isPublic: false,
      },
    ]);
    // Deleted by its end-user author: not an action of the team (§13.5).
    expect(await prisma.auditLogEntry.count({ where: { targetId: comment.id } })).toBe(0);
    // "Comment deleted" stays in the team timeline only (Q6, Q7).
    const timeline = async (user: User) =>
      (
        await http()
          .get(`/api/v1/tickets/${ticket.id}/timeline`)
          .set('Authorization', await as(user))
      ).body as TimelinePage;
    expect((await timeline(developer)).items).toMatchObject([
      { type: 'event', event: { type: 'comment_deleted', actor: { id: requester.id } } },
    ]);
    expect((await timeline(requester)).items).toEqual([]);
  });

  it('lets the team delete any comment and writes it to the audit log (§13.5)', async () => {
    const { developer, comment, ticket } = await setUp();

    expect((await remove(developer, comment.id)).status).toBe(204);
    expect(await prisma.auditLogEntry.findMany({ where: { targetId: comment.id } })).toMatchObject([
      {
        action: 'comment.deleted',
        actorId: developer.id,
        targetType: 'Comment',
        details: { ticketId: ticket.id, kind: 'public' },
      },
    ]);
  });

  it('refuses another end user with 403 and a stale version with 412', async () => {
    const { colleague, requester, comment } = await setUp();

    expect((await remove(colleague, comment.id)).status).toBe(403);
    expect((await remove(requester, comment.id, 5)).status).toBe(412);
    expect(await prisma.comment.count({ where: { id: comment.id } })).toBe(1);
  });

  it('deletes a single file of a comment with an internal event (Q16)', async () => {
    const { requester, ticket, file } = await setUp();

    const res = await http()
      .delete(`/api/v1/attachments/${file.id}`)
      .set('Authorization', await as(requester));

    expect(res.status).toBe(204);
    expect(await prisma.activityEvent.findMany({ where: { ticketId: ticket.id } })).toMatchObject([
      { type: 'attachment_deleted', isPublic: false, actorId: requester.id },
    ]);
  });
});
