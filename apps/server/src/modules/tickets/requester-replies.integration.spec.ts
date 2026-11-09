// The requester-reply rules end to end (§4.3, S1-12 Q10, Q15): a public comment of the
// requester answers a wait or reopens a done ticket, in the transaction of the comment.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CommentResponse } from '@trybun/contracts/comments';
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

const DAY_MS = 24 * 60 * 60 * 1000;

async function authorizationOf(config: TrybunConfig, user: User): Promise<string> {
  const token = await signAccessToken(config, {
    sub: user.keycloakUserId ?? '',
    amr: user.kind === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
  });
  return `Bearer ${token}`;
}

describe('requester replies', () => {
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
  const comment = async (user: User, ticketId: string, kind: 'public' | 'internal' = 'public') =>
    http()
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', await as(user))
      .send({ kind, body: 'Still broken on my side' });
  const stateOf = (id: string) =>
    prisma.ticket.findUniqueOrThrow({
      where: { id },
      select: { status: true, waitingReason: true, closedAt: true, version: true },
    });

  async function setUp(ticket: Partial<Parameters<typeof createTicket>[1]>) {
    const project = await createProject(prisma);
    const developer = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'team' });
    await createProjectMember(prisma, { projectId: project.id, userId: developer.id });
    const customer = async () => {
      const user = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'end_user' });
      await createProjectMember(prisma, {
        projectId: project.id,
        userId: user.id,
        role: 'end_user',
      });
      return user;
    };
    const [requester, other] = [await customer(), await customer()];
    const row = await createTicket(prisma, {
      projectId: project.id,
      requesterId: requester.id,
      source: 'user',
      type: null,
      visibility: 'all_customers',
      ...ticket,
      status: ticket.status ?? 'new',
    });
    return { developer, requester, other, ticket: row };
  }

  it('moves a ticket that waits for the confirmation to in_progress (§4.3)', async () => {
    const { requester, ticket } = await setUp({
      status: 'waiting_for_requester',
      waitingReason: 'confirmation',
      statusBeforeWaiting: 'in_verification',
    });

    const res = await comment(requester, ticket.id);

    expect(res.status).toBe(201);
    expect(await stateOf(ticket.id)).toMatchObject({
      status: 'in_progress',
      waitingReason: null,
      version: ticket.version + 1,
    });
    expect(
      await prisma.activityEvent.findMany({
        where: { ticketId: ticket.id, type: 'status_changed' },
      }),
    ).toMatchObject([
      {
        actorId: requester.id,
        automaticSource: null,
        isPublic: true,
        data: { from: 'waiting_for_requester', to: 'in_progress', reopen: false },
      },
    ]);
    const [event] = await prisma.outboxEvent.findMany({
      where: { type: 'ticket.status_changed', payload: { path: ['ticketId'], equals: ticket.id } },
    });
    expect(event?.payload).toMatchObject({
      to: 'in_progress',
      actorId: requester.id,
      commentId: (res.body as CommentResponse).id,
    });
  });

  it('returns a ticket that waits for information to its status before waiting', async () => {
    const { requester, ticket } = await setUp({
      status: 'waiting_for_requester',
      waitingReason: 'information',
      statusBeforeWaiting: 'todo',
    });

    await comment(requester, ticket.id);

    expect(await stateOf(ticket.id)).toMatchObject({ status: 'todo', waitingReason: null });
  });

  it('reopens a ticket done 13 days ago as triage', async () => {
    const { requester, ticket } = await setUp({
      status: 'done',
      closedAt: new Date(Date.now() - 13 * DAY_MS),
    });

    await comment(requester, ticket.id);

    expect(await stateOf(ticket.id)).toMatchObject({ status: 'triage', closedAt: null });
    expect(
      await prisma.activityEvent.findFirst({
        where: { ticketId: ticket.id, type: 'status_changed' },
      }),
    ).toMatchObject({ data: { from: 'done', to: 'triage', reopen: true } });
  });

  it.each(['other', 'developer'] as const)(
    'changes nothing for a comment of the %s (Q10)',
    async (who) => {
      const fixtures = await setUp({
        status: 'waiting_for_requester',
        waitingReason: 'confirmation',
        statusBeforeWaiting: 'in_verification',
      });

      expect((await comment(fixtures[who], fixtures.ticket.id)).status).toBe(201);
      expect(await stateOf(fixtures.ticket.id)).toMatchObject({
        status: 'waiting_for_requester',
        version: fixtures.ticket.version,
      });
    },
  );

  it('lets the comment win over a later "Yes, solved", which finds no wait (§4.3)', async () => {
    const { requester, ticket } = await setUp({
      status: 'waiting_for_requester',
      waitingReason: 'confirmation',
      statusBeforeWaiting: 'in_verification',
    });

    await comment(requester, ticket.id);
    const answer = await http()
      .post(`/api/v1/tickets/${ticket.id}/resolution-confirmation`)
      .set('Authorization', await as(requester))
      .send({ answer: 'solved' });

    expect(answer.status).toBe(409);
    expect(answer.body).toMatchObject({ code: 'ticket.resolution_confirmation_not_pending' });
    expect((await stateOf(ticket.id)).status).toBe('in_progress');
  });

  it('reopens a ticket solved just before the comment (§4.3)', async () => {
    const { requester, ticket } = await setUp({
      status: 'waiting_for_requester',
      waitingReason: 'confirmation',
      statusBeforeWaiting: 'in_verification',
    });

    await http()
      .post(`/api/v1/tickets/${ticket.id}/resolution-confirmation`)
      .set('Authorization', await as(requester))
      .send({ answer: 'solved' });
    await comment(requester, ticket.id);

    expect((await stateOf(ticket.id)).status).toBe('triage');
  });
});
