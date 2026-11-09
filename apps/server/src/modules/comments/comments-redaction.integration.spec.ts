// Redaction end to end (S1-12, §6.1, §13.2, Q9): after a redaction with the default selection no
// row of the database holds the redacted text; the events and the audit log hold no content.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
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


describe('redaction', () => {
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

  /** The tables of S1-12's guarantee: no row of them may hold the redacted text. */
  async function rowsWith(text: string): Promise<string[]> {
    const pattern = `%${text}%`;
    const found = await prisma.$queryRaw<{ table: string }[]>`
      SELECT 'content_revisions' AS "table" FROM content_revisions WHERE body LIKE ${pattern}
      UNION ALL SELECT 'comments' FROM comments WHERE body LIKE ${pattern}
      UNION ALL SELECT 'tickets' FROM tickets WHERE description LIKE ${pattern}
      UNION ALL SELECT 'activity_events' FROM activity_events WHERE data::text LIKE ${pattern}
      UNION ALL SELECT 'outbox_events' FROM outbox_events WHERE payload::text LIKE ${pattern}
      UNION ALL SELECT 'audit_log_entries' FROM audit_log_entries WHERE details::text LIKE ${pattern}`;
    return found.map(({ table }) => table);
  }

  async function setUp() {
    // A secret of this test: other tests of the database hold their own.
    const SECRET = `IBAN PL61 1090 1014 ${randomUUID()}`;
    const project = await createProject(prisma);
    const developer = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'team' });
    await createProjectMember(prisma, { projectId: project.id, userId: developer.id });
    const requester = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'end_user' });
    await createProjectMember(prisma, {
      projectId: project.id,
      userId: requester.id,
      role: 'end_user',
    });
    const ticket = await createTicket(prisma, {
      projectId: project.id,
      requesterId: requester.id,
      source: 'user',
      status: 'new',
      type: null,
      description: `My account: ${SECRET}`,
    });
    return { developer, requester, ticket, SECRET };
  }

  it('leaves no copy of a redacted comment with the default selection (§13.2)', async () => {
    const { developer, requester, ticket, SECRET } = await setUp();
    const created = await http()
      .post(`/api/v1/tickets/${ticket.id}/comments`)
      .set('Authorization', await as(requester))
      .send({ kind: 'public', body: `Pay to ${SECRET}` });
    const id = (created.body as { id: string }).id;
    await http()
      .patch(`/api/v1/comments/${id}`)
      .set('Authorization', await as(requester))
      .set('If-Match', 'W/"1"')
      .send({ body: `Pay to ${SECRET}, thanks` });
    const revisions = await prisma.contentRevision.findMany({ where: { commentId: id } });

    const res = await http()
      .post(`/api/v1/comments/${id}/redaction`)
      .set('Authorization', await as(developer))
      .set('If-Match', 'W/"2"')
      .send({ body: 'Pay to [redacted]', purgeRevisionIds: revisions.map((row) => row.id) });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ body: 'Pay to [redacted]', version: 3 });
    // The description of the ticket still holds it: only the comment was redacted.
    expect(await rowsWith(SECRET)).toEqual(['tickets']);
    expect(await prisma.activityEvent.findMany({ where: { ticketId: ticket.id } })).toMatchObject([
      { type: 'comment_edited' },
      { type: 'comment_redacted', data: { commentId: id }, isPublic: false, actorId: developer.id },
    ]);
    expect(await prisma.auditLogEntry.findMany({ where: { targetId: id } })).toMatchObject([
      { action: 'comment.redacted', actorId: developer.id, details: { ticketId: ticket.id } },
    ]);
  });

  it('leaves no copy of a redacted description with the default selection', async () => {
    const { developer, requester, ticket, SECRET } = await setUp();
    await http()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set('Authorization', await as(requester))
      .set('If-Match', 'W/"1"')
      .send({ description: `Account ${SECRET} (updated)` });
    const revisions = await prisma.contentRevision.findMany({ where: { ticketId: ticket.id } });

    const res = await http()
      .post(`/api/v1/tickets/${ticket.id}/description-redaction`)
      .set('Authorization', await as(developer))
      .set('If-Match', 'W/"2"')
      .send({ description: 'Account [redacted]', purgeRevisionIds: revisions.map(({ id }) => id) });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      description: 'Account [redacted]',
      descriptionEditedAt: expect.any(String) as string,
    });
    expect(await rowsWith(SECRET)).toEqual([]);
    expect(
      (await prisma.activityEvent.findMany({ where: { ticketId: ticket.id } })).map(
        ({ type }) => type,
      ),
    ).toEqual(['description_edited', 'description_redacted']);
  });

  it('keeps the revisions left unselected', async () => {
    const { developer, requester, ticket } = await setUp();
    await http()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set('Authorization', await as(requester))
      .set('If-Match', 'W/"1"')
      .send({ description: 'Second' });

    await http()
      .post(`/api/v1/tickets/${ticket.id}/description-redaction`)
      .set('Authorization', await as(developer))
      .set('If-Match', 'W/"2"')
      .send({ description: 'Third', purgeRevisionIds: [] });

    expect(await prisma.contentRevision.count({ where: { ticketId: ticket.id } })).toBe(1);
  });

  it('refuses an end user with 403, a stale version with 412 and a foreign revision with 422', async () => {
    const { developer, requester, ticket } = await setUp();
    const send = async (user: User, version: number, purgeRevisionIds: string[]) =>
      http()
        .post(`/api/v1/tickets/${ticket.id}/description-redaction`)
        .set('Authorization', await as(user))
        .set('If-Match', `W/"${version}"`)
        .send({ description: '', purgeRevisionIds });

    expect((await send(requester, 1, [])).status).toBe(403);
    expect((await send(developer, 9, [])).status).toBe(412);
    const foreign = await send(developer, 1, [randomUUID()]);
    expect(foreign.status).toBe(422);
    expect(foreign.body).toMatchObject({
      errors: [{ pointer: '/purgeRevisionIds/0', code: 'field.invalid' }],
    });
    expect(
      await prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        select: { version: true },
      }),
    ).toEqual({ version: 1 });
  });
});
