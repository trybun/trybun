// Reading comments end to end (S1-12, §5.2, §6.1): the audience of public comments, internal
// notes that never reach end users, the merged timeline and the identity rule of mentions.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CommentPage, CommentResponse, TimelinePage } from '@trybun/contracts/comments';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createActivityEvent } from '../../../test/factories/activity-event.factory.js';
import { createAttachment } from '../../../test/factories/attachment.factory.js';
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

describe('reading comments', () => {
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
  const get = async (user: User, path: string) =>
    http()
      .get(`/api/v1${path}`)
      .set('Authorization', await authorizationOf(config, user));

  const endUser = () => createUser(prisma, { keycloakUserId: randomUUID(), kind: 'end_user' });

  /** A project of two organizations, a Developer, a requester and their colleague, a stranger. */
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
    const developer = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'team' });
    await createProjectMember(prisma, { projectId: project.id, userId: developer.id });
    const [requester, colleague, stranger] = [await endUser(), await endUser(), await endUser()];
    await prisma.organizationMember.createMany({
      data: [
        { organizationId: organization.id, userId: requester.id },
        { organizationId: organization.id, userId: colleague.id },
        { organizationId: otherOrganization.id, userId: stranger.id },
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
    return { project, organization, developer, requester, colleague, stranger, ticket };
  }

  const idsOf = (page: { items: { id: string }[] }) => page.items.map(({ id }) => id);

  it('keeps a comment written before sharing inside its audience (§5.2)', async () => {
    const { organization, developer, requester, colleague, stranger, ticket } = await setUp();
    const before = await createComment(prisma, {
      ticketId: ticket.id,
      authorId: requester.id,
      audience: 'my_organization',
      audienceOrganizationId: organization.id,
    });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { visibility: 'all_customers' } });
    const after = await createComment(prisma, {
      ticketId: ticket.id,
      authorId: developer.id,
      audience: 'all_customers',
    });

    const asStranger = await get(stranger, `/tickets/${ticket.id}/comments`);
    const asColleague = await get(colleague, `/tickets/${ticket.id}/comments`);

    expect(asStranger.status).toBe(200);
    expect(idsOf(asStranger.body as CommentPage)).toEqual([after.id]);
    expect(idsOf(asColleague.body as CommentPage)).toEqual([before.id, after.id]);
    expect((await get(stranger, `/comments/${before.id}`)).status).toBe(404);
    expect((await get(colleague, `/comments/${before.id}`)).status).toBe(200);
  });

  it('never shows an internal note or its attachment to an end user (§6.1)', async () => {
    const { developer, requester, ticket } = await setUp();
    const note = await createComment(prisma, {
      ticketId: ticket.id,
      authorId: developer.id,
      kind: 'internal',
    });
    const file = await createAttachment(prisma, {
      uploadedById: developer.id,
      commentId: note.id,
      status: 'available',
    });
    await createActivityEvent(prisma, { ticketId: ticket.id, actorId: developer.id });

    const list = await get(requester, `/tickets/${ticket.id}/comments`);
    const detail = await get(requester, `/comments/${note.id}`);
    const timeline = await get(requester, `/tickets/${ticket.id}/timeline`);
    const attachment = await get(requester, `/attachments/${file.id}`);
    const asTeam = await get(developer, `/comments/${note.id}`);

    expect((list.body as CommentPage).items).toEqual([]);
    expect(detail.status).toBe(404);
    expect((timeline.body as TimelinePage).items.some((item) => item.type === 'comment')).toBe(
      false,
    );
    expect(attachment.status).toBe(404);
    expect(asTeam.body).toMatchObject({
      id: note.id,
      kind: 'internal',
      audience: null,
      attachments: [{ id: file.id, commentId: note.id, ticketId: null }],
    });
  });

  it('merges comments and events by time and pages them with one cursor (Q11)', async () => {
    const { developer, ticket } = await setUp();
    const first = await createActivityEvent(prisma, { ticketId: ticket.id, actorId: developer.id });
    const comment = await createComment(prisma, { ticketId: ticket.id, authorId: developer.id });
    const last = await createActivityEvent(prisma, { ticketId: ticket.id, actorId: developer.id });

    const page = (await get(developer, `/tickets/${ticket.id}/timeline?limit=2`))
      .body as TimelinePage;
    const next = (
      await get(
        developer,
        `/tickets/${ticket.id}/timeline?limit=2&cursor=${encodeURIComponent(page.nextCursor ?? '')}`,
      )
    ).body as TimelinePage;

    expect(page.items.map((item) => item.type)).toEqual(['event', 'comment']);
    expect(page.items[0]).toMatchObject({ event: { id: first.id } });
    expect(page.items[1]).toMatchObject({ comment: { id: comment.id } });
    expect(next).toMatchObject({
      items: [{ type: 'event', event: { id: last.id } }],
      nextCursor: null,
    });
  });

  it('shows only comments in the timeline with Hide events on (§4.5)', async () => {
    const { developer, ticket } = await setUp();
    await createActivityEvent(prisma, { ticketId: ticket.id, actorId: developer.id });
    const comment = await createComment(prisma, { ticketId: ticket.id, authorId: developer.id });
    await prisma.user.update({ where: { id: developer.id }, data: { hideTimelineEvents: true } });

    const page = (await get(developer, `/tickets/${ticket.id}/timeline`)).body as TimelinePage;

    expect(page.items).toEqual([
      { type: 'comment', comment: expect.objectContaining({ id: comment.id }) as unknown },
    ]);
  });

  it('hides the ID and the name of a mentioned person the reader may not see (§5.4)', async () => {
    const { developer, requester, stranger, ticket } = await setUp();
    await prisma.ticket.update({ where: { id: ticket.id }, data: { visibility: 'all_customers' } });
    const comment = await createComment(prisma, {
      ticketId: ticket.id,
      authorId: developer.id,
      audience: 'all_customers',
      body: `Thanks @{${requester.id}}, see @{${developer.id}}`,
    });
    await prisma.commentMention.createMany({
      data: [
        { commentId: comment.id, userId: requester.id },
        { commentId: comment.id, userId: developer.id },
      ],
    });

    const asStranger = (await get(stranger, `/comments/${comment.id}`)).body as CommentResponse;
    const asRequester = (await get(requester, `/comments/${comment.id}`)).body as CommentResponse;

    expect(asStranger.body).toBe(`Thanks @{customer}, see @{${developer.id}}`);
    expect(asStranger.mentions).toEqual([
      { id: developer.id, displayName: developer.displayName },
      { id: 'customer', displayName: null },
    ]);
    expect(JSON.stringify(asStranger)).not.toContain(requester.id);
    expect(asRequester.body).toBe(comment.body);
    expect(asRequester).not.toHaveProperty('kind');
    expect(asRequester).not.toHaveProperty('audience');
  });

  it('answers 404 for a comment of a ticket of another project', async () => {
    const { ticket, developer } = await setUp();
    const otherDeveloper = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'team' });
    const comment = await createComment(prisma, { ticketId: ticket.id, authorId: developer.id });

    expect((await get(otherDeveloper, `/comments/${comment.id}`)).status).toBe(404);
    expect((await get(otherDeveloper, `/tickets/${ticket.id}/timeline`)).status).toBe(404);
  });
});
