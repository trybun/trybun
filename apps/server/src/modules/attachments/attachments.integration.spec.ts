// Reading, downloading, linking and deleting attachments (§3.2, §13.3, ADR 0008, S1-08 step 7)
// against PostgreSQL and SeaweedFS of the global set-up: the content response and its headers,
// the responses per status, invisible attachments, the linking rules (Q4, Q11), the permissions of
// Q14, archived projects and the activity events of Q9, Q15 and Q16.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Readable } from 'node:stream';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ActivityEventPage } from '@trybun/contracts/activity-events';
import type { Attachment, AttachmentList, AttachmentPage } from '@trybun/contracts/attachments';
import type { ProblemDetails } from '@trybun/contracts/problem-details';
import type { Ticket } from '@trybun/contracts/tickets';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  strictEndUserActivityEventSchema,
  strictPageSchema,
} from '../../../test/end-user-schemas.js';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import {
  type AttachmentFactoryInput,
  createAttachment,
} from '../../../test/factories/attachment.factory.js';
import { createProjectMember } from '../../../test/factories/project-member.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createTicket } from '../../../test/factories/ticket.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { ApiModule } from '../../api.module.js';
import type { Project, User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';
import {
  availableKey,
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../platform/storage/object-storage.js';
import { ATTACHMENT_DELETED } from './attachments.events.js';

/** A PNG image of 1 × 1 pixel. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from(
  '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
);

type Who = 'developer' | 'project_manager' | 'end_user';

/** Collects a response body as bytes, whatever its type. */
function binary(res: request.Response, callback: (error: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => {
    callback(null, Buffer.concat(chunks));
  });
}

describe('attachments', () => {
  const config = integrationConfig();
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let storage: ObjectStorage;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiModule.forRoot(config)],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get<ObjectStorage>(OBJECT_STORAGE);
  });

  beforeEach(() => {
    mswServer.use(keycloakJwksHandler(config));
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  /** A signed-in account with the role in the projects; team members with 2FA (§7.4). */
  async function signIn(who: Who, ...projects: Project[]) {
    const user = await createUser(prisma, {
      keycloakUserId: randomUUID(),
      kind: who === 'end_user' ? 'end_user' : 'team',
    });
    for (const project of projects) {
      await createProjectMember(prisma, { projectId: project.id, userId: user.id, role: who });
    }
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: who === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
    });
    return { user, authorization: `Bearer ${token}` };
  }

  type Account = Awaited<ReturnType<typeof signIn>>;

  /** A project with a Developer and an end user who requested one ticket of it. */
  async function setUp(overrides: Parameters<typeof createProject>[1] = {}) {
    const project = await createProject(prisma, overrides);
    const developer = await signIn('developer', project);
    const requester = await signIn('end_user', project);
    const ticket = await createTicket(prisma, {
      projectId: project.id,
      requesterId: requester.user.id,
      source: 'user',
      status: 'new',
      type: null,
    });
    return { project, developer, requester, ticket };
  }

  /** An attachment row; an available one with its object in `available/`. */
  async function attachment(
    uploadedBy: User,
    input: Omit<AttachmentFactoryInput, 'uploadedById'> & { content?: Buffer } = {},
  ) {
    const { content, ...row } = input;
    const created = await createAttachment(prisma, { uploadedById: uploadedBy.id, ...row });
    if (content !== undefined) {
      await storage.put(availableKey(created.id), Readable.from([content]));
    }
    return created;
  }

  function get(account: Account, path: string, query: object = {}) {
    return http().get(`/api/v1${path}`).query(query).set('Authorization', account.authorization);
  }

  function download(account: Account, attachmentId: string) {
    return http()
      .get(`/api/v1/attachments/${attachmentId}/content`)
      .set('Authorization', account.authorization)
      .buffer(true)
      .parse(binary);
  }

  function remove(account: Account, attachmentId: string) {
    return http()
      .delete(`/api/v1/attachments/${attachmentId}`)
      .set('Authorization', account.authorization);
  }

  function link(account: Account, ticketId: string, attachmentIds: string[]) {
    return http()
      .post(`/api/v1/tickets/${ticketId}/attachments`)
      .set('Authorization', account.authorization)
      .send({ attachmentIds });
  }

  async function events(account: Account, ticketId: string) {
    const res = await get(account, `/tickets/${ticketId}/activity-events`);
    expect(res.status).toBe(200);
    return (res.body as ActivityEventPage).items;
  }

  async function ticketIdOf(attachmentId: string) {
    const row = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: { ticketId: true },
    });
    return row?.ticketId;
  }

  /** The body of a `404`, without the request path. */
  function notFoundBody(res: request.Response) {
    expect(res.status).toBe(404);
    return { ...(res.body as ProblemDetails), instance: undefined };
  }

  describe('GET /api/v1/attachments/{attachmentId}/content', () => {
    it('streams an image inline with the forced headers', async () => {
      const { developer, requester, ticket } = await setUp();
      const image = await attachment(requester.user, {
        ticketId: ticket.id,
        status: 'available',
        fileName: 'screenshot.png',
        contentType: 'image/png',
        size: PNG.length,
        content: PNG,
      });

      const res = await download(developer, image.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(PNG);
      expect(res.headers).toMatchObject({
        'content-type': 'image/png',
        'content-length': String(PNG.length),
        'content-disposition': `inline; filename="screenshot.png"; filename*=UTF-8''screenshot.png`,
        'content-security-policy': "default-src 'none'; sandbox",
        'cross-origin-resource-policy': 'same-origin',
        'x-content-type-options': 'nosniff',
        'cache-control': 'private',
        etag: `"${image.id}"`,
      });
    });

    it('sends any other file as a download with its UTF-8 name', async () => {
      const { requester, ticket } = await setUp();
      const pdf = await attachment(requester.user, {
        ticketId: ticket.id,
        status: 'available',
        fileName: 'Faktura – żółć.pdf',
        contentType: 'application/pdf',
        size: PDF.length,
        content: PDF,
      });

      const res = await download(requester, pdf.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(PDF);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="Faktura _ ____.pdf"; ` +
          `filename*=UTF-8''Faktura%20%E2%80%93%20%C5%BC%C3%B3%C5%82%C4%87.pdf`,
      );
    });

    it('answers a current copy with 304 and no body', async () => {
      const { requester, ticket } = await setUp();
      const image = await attachment(requester.user, {
        ticketId: ticket.id,
        status: 'available',
        contentType: 'image/png',
        size: PNG.length,
        content: PNG,
      });

      const res = await download(requester, image.id).set('If-None-Match', `"${image.id}"`);
      const other = await download(requester, image.id).set('If-None-Match', '"other"');

      expect(res.status).toBe(304);
      expect(res.body).toEqual(Buffer.alloc(0));
      expect(res.headers).toMatchObject({ etag: `"${image.id}"`, 'cache-control': 'private' });
      expect(other.status).toBe(200);
      expect(other.body).toEqual(PNG);
    });

    it.each([
      ['quarantine', 409, 'attachment.not_available'],
      ['infected', 410, 'attachment.removed'],
      ['rejected', 410, 'attachment.removed'],
    ] as const)('answers an attachment in %s with %i %s', async (status, httpStatus, code) => {
      const { requester, ticket } = await setUp();
      const row = await attachment(requester.user, { ticketId: ticket.id, status });

      const res = await http()
        .get(`/api/v1/attachments/${row.id}/content`)
        .set('Authorization', requester.authorization);

      expect(res.status).toBe(httpStatus);
      expect((res.body as ProblemDetails).code).toBe(code);
    });

    it('answers an available attachment whose object is gone like a removed file (Q21)', async () => {
      const { requester, ticket } = await setUp();
      const row = await attachment(requester.user, { ticketId: ticket.id, status: 'available' });

      const res = await http()
        .get(`/api/v1/attachments/${row.id}/content`)
        .set('Authorization', requester.authorization);

      expect(res.status).toBe(410);
      expect((res.body as ProblemDetails).code).toBe('attachment.removed');
    });
  });

  describe('invisible attachments (§17.2)', () => {
    type Ids = { attachmentId: string; ticketId: string };
    const requests: [string, (account: Account, ids: Ids) => request.Test][] = [
      ['reading', (account, ids) => get(account, `/attachments/${ids.attachmentId}`)],
      ['downloading', (account, ids) => get(account, `/attachments/${ids.attachmentId}/content`)],
      ['deleting', (account, ids) => remove(account, ids.attachmentId)],
      ['listing', (account, ids) => get(account, `/tickets/${ids.ticketId}/attachments`)],
      ['linking', (account, ids) => link(account, ids.ticketId, [randomUUID()])],
    ];

    // One test per account and request (#292): PostgreSQL plans the read filter of an end user,
    // over a hundred joins, in about 0.3 s, so all of them in one test ran into its 5 s timeout.
    describe.each([
      ['another requester of the project', (project: Project) => signIn('end_user', project)],
      [
        'a Developer of another project',
        async () => signIn('developer', await createProject(prisma)),
      ],
    ] as const)('for %s, who cannot see the ticket', (_viewer, signInViewer) => {
      it.each(requests)('answers %s 404, as for an unknown ID', async (_request, send) => {
        const { project, requester, ticket } = await setUp();
        const row = await attachment(requester.user, {
          ticketId: ticket.id,
          status: 'available',
          content: PDF,
        });
        const account = await signInViewer(project);

        expect(
          notFoundBody(await send(account, { attachmentId: row.id, ticketId: ticket.id })),
        ).toEqual(
          notFoundBody(await send(account, { attachmentId: randomUUID(), ticketId: randomUUID() })),
        );
        expect(await prisma.attachment.findUnique({ where: { id: row.id } })).not.toBeNull();
      });
    });

    it("keeps another person's draft invisible: 404 for reading, downloading, deleting and linking", async () => {
      const { developer, requester, ticket } = await setUp();
      const draft = await attachment(developer.user, { status: 'available', content: PNG });

      for (const res of [
        await get(requester, `/attachments/${draft.id}`),
        await get(requester, `/attachments/${draft.id}/content`),
        await remove(requester, draft.id),
        await link(requester, ticket.id, [draft.id]),
      ]) {
        expect(res.status).toBe(404);
        expect((res.body as ProblemDetails).code).toBe('request.not_found');
      }
      expect(await ticketIdOf(draft.id)).toBeNull();
    });
  });

  describe('GET /api/v1/attachments', () => {
    it('lists the readable attachments in the order of the IDs and leaves out the others', async () => {
      const { developer, requester, ticket } = await setUp();
      const own = await attachment(requester.user);
      const linked = await attachment(developer.user, { ticketId: ticket.id });
      const othersDraft = await attachment(developer.user);

      const res = await get(requester, '/attachments', {
        id: [linked.id, othersDraft.id, randomUUID(), own.id],
      });

      expect(res.status).toBe(200);
      const page = res.body as AttachmentPage;
      expect(page.items.map(({ id }) => id)).toEqual([linked.id, own.id]);
      expect(page.nextCursor).toBeNull();
      expect(page.items[1]).toMatchObject({
        ticketId: null,
        status: 'quarantine',
        uploadedBy: { id: requester.user.id },
        allowedActions: ['read', 'delete'],
      });
      expect(page.items[0]?.allowedActions).toEqual(['read']);
    });

    it('accepts one ID and refuses 51', async () => {
      const { requester } = await setUp();
      const own = await attachment(requester.user);

      const one = await get(requester, '/attachments', { id: own.id });
      const tooMany = await get(requester, '/attachments', {
        id: Array.from({ length: 51 }, () => randomUUID()),
      });

      expect((one.body as AttachmentPage).items.map(({ id }) => id)).toEqual([own.id]);
      expect(tooMany.status).toBe(422);
    });
  });

  describe('GET /api/v1/attachments/{attachmentId}', () => {
    it('returns the attachment with its actions', async () => {
      const { developer, requester, ticket } = await setUp();
      const row = await attachment(requester.user, {
        ticketId: ticket.id,
        status: 'available',
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
      });

      const asRequester = await get(requester, `/attachments/${row.id}`);
      const asDeveloper = await get(developer, `/attachments/${row.id}`);

      expect(asRequester.status).toBe(200);
      expect(asRequester.body).toEqual({
        id: row.id,
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
        size: row.size,
        isImage: true,
        status: 'available',
        ticketId: ticket.id,
        commentId: null,
        uploadedBy: { id: requester.user.id, displayName: requester.user.displayName },
        createdAt: row.createdAt.toISOString(),
        allowedActions: ['read', 'delete'],
      } satisfies Attachment);
      expect((asDeveloper.body as Attachment).allowedActions).toEqual(['read', 'delete']);
    });
  });

  describe('GET /api/v1/tickets/{ticketId}/attachments', () => {
    it('pages through the attachments of the ticket, oldest first', async () => {
      const { developer, requester, ticket } = await setUp();
      const other = await createTicket(prisma, {
        projectId: ticket.projectId,
        requesterId: requester.user.id,
      });
      const base = Date.now();
      const rows: { id: string }[] = [];
      for (const [index, uploadedBy] of [requester, developer, requester].entries()) {
        rows.push(
          await attachment(uploadedBy.user, {
            ticketId: ticket.id,
            createdAt: new Date(base + index * 1000),
          }),
        );
      }
      await attachment(requester.user, { ticketId: other.id });
      await attachment(requester.user);

      const first = await get(requester, `/tickets/${ticket.id}/attachments`, { limit: 2 });
      const firstPage = first.body as AttachmentPage;
      const second = await get(requester, `/tickets/${ticket.id}/attachments`, {
        limit: 2,
        cursor: firstPage.nextCursor,
      });
      const secondPage = second.body as AttachmentPage;

      expect(first.status).toBe(200);
      expect([...firstPage.items, ...secondPage.items].map(({ id }) => id)).toEqual(
        rows.map(({ id }) => id),
      );
      expect(firstPage.nextCursor).not.toBeNull();
      expect(secondPage.nextCursor).toBeNull();
      // The requester deletes their own files, not the Developer's (§7.5).
      expect(firstPage.items.map(({ allowedActions }) => allowedActions)).toEqual([
        ['read', 'delete'],
        ['read'],
      ]);
    });
  });

  describe('POST /api/v1/tickets/{ticketId}/attachments', () => {
    it('links own drafts in any status with one public event per file', async () => {
      const { developer, requester, ticket } = await setUp();
      const log = await attachment(requester.user, { fileName: 'log.txt', status: 'available' });
      const infected = await attachment(requester.user, {
        fileName: 'virus.zip',
        status: 'infected',
      });
      const { version } = ticket;

      const res = await link(requester, ticket.id, [log.id, infected.id]);

      expect(res.status).toBe(200);
      expect((res.body as AttachmentList).items).toMatchObject([
        { id: log.id, ticketId: ticket.id, status: 'available' },
        { id: infected.id, ticketId: ticket.id, status: 'infected' },
      ]);
      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(after.version).toBe(version);
      const added = [
        { from: null, to: { id: log.id, displayName: 'log.txt' } },
        { from: null, to: { id: infected.id, displayName: 'virus.zip' } },
      ];
      expect(await events(developer, ticket.id)).toMatchObject(
        added.map((data) => ({
          type: 'attachment_added',
          data,
          actor: { id: requester.user.id },
        })),
      );
      // The requester sees the events in the end-user shape, with the file names (Q15).
      const forRequester = await get(requester, `/tickets/${ticket.id}/activity-events`);
      const page = strictPageSchema(strictEndUserActivityEventSchema).parse(forRequester.body);
      expect(page.items.map(({ type, data }) => ({ type, data }))).toEqual(
        added.map((data) => ({ type: 'attachment_added', data })),
      );
    });

    it('refuses an own attachment that is already linked with 422 and links nothing', async () => {
      const { requester, ticket } = await setUp();
      const draft = await attachment(requester.user);
      const linked = await attachment(requester.user, { ticketId: ticket.id });

      const res = await link(requester, ticket.id, [draft.id, linked.id]);

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        code: 'attachment.already_linked',
        errors: [{ pointer: '/attachmentIds/1', code: 'field.invalid' }],
      });
      expect(await ticketIdOf(draft.id)).toBeNull();
      expect(await events(requester, ticket.id)).toEqual([]);
    });

    it.each([
      ['an unknown ID', () => Promise.resolve(randomUUID())],
      ["another person's draft", async (developer: User) => (await attachment(developer)).id],
    ] as const)('answers %s with 404 before an already linked one', async (_case, idOf) => {
      const { developer, requester, ticket } = await setUp();
      const linked = await attachment(requester.user, { ticketId: ticket.id });
      const draft = await attachment(requester.user);

      const res = await link(requester, ticket.id, [
        linked.id,
        draft.id,
        await idOf(developer.user),
      ]);

      expect(res.status).toBe(404);
      expect((res.body as ProblemDetails).code).toBe('request.not_found');
      expect(await ticketIdOf(draft.id)).toBeNull();
    });

    it('refuses an end user who lost access to the project with 403 (Q14)', async () => {
      const { project, requester, ticket } = await setUp();
      const own = await attachment(requester.user, {
        ticketId: ticket.id,
        status: 'available',
        content: PDF,
      });
      const draft = await attachment(requester.user);
      await prisma.projectMember.deleteMany({
        where: { projectId: project.id, userId: requester.user.id },
      });

      const added = await link(requester, ticket.id, [draft.id]);
      const deleted = await remove(requester, own.id);

      expect(added.status).toBe(403);
      expect(deleted.status).toBe(403);
      expect((await download(requester, own.id)).status).toBe(200);
      expect((await get(requester, `/attachments/${own.id}`)).body).toMatchObject({
        allowedActions: ['read'],
      });
      expect(await ticketIdOf(draft.id)).toBeNull();
    });
  });

  describe('DELETE /api/v1/attachments/{attachmentId}', () => {
    it('deletes a linked attachment with a public event and the event of its objects', async () => {
      const { developer, requester, ticket } = await setUp();
      const row = await attachment(requester.user, {
        ticketId: ticket.id,
        status: 'available',
        fileName: 'log.txt',
        content: PDF,
      });

      const res = await remove(developer, row.id);

      expect(res.status).toBe(204);
      expect(await prisma.attachment.findUnique({ where: { id: row.id } })).toBeNull();
      const outbox = await prisma.outboxEvent.findMany({
        where: { payload: { path: ['attachmentId'], equals: row.id } },
        select: { type: true, payload: true },
      });
      // The Worker deletes both objects when it consumes the event (attachments-jobs).
      expect(outbox).toEqual([{ type: ATTACHMENT_DELETED, payload: { attachmentId: row.id } }]);
      const deleted = { from: { id: row.id, displayName: 'log.txt' }, to: null };
      expect(await events(developer, ticket.id)).toMatchObject([
        { type: 'attachment_deleted', data: deleted, actor: { id: developer.user.id } },
      ]);
      const forRequester = await get(requester, `/tickets/${ticket.id}/activity-events`);
      expect(
        strictPageSchema(strictEndUserActivityEventSchema).parse(forRequester.body).items,
      ).toMatchObject([{ type: 'attachment_deleted', data: deleted }]);
      expect((await get(requester, `/attachments/${row.id}`)).status).toBe(404);
    });

    it('deletes an own draft without an activity event', async () => {
      const { requester } = await setUp();
      const draft = await attachment(requester.user);

      const res = await remove(requester, draft.id);

      expect(res.status).toBe(204);
      expect(await prisma.attachment.findUnique({ where: { id: draft.id } })).toBeNull();
      expect(
        await prisma.outboxEvent.count({
          where: {
            type: ATTACHMENT_DELETED,
            payload: { path: ['attachmentId'], equals: draft.id },
          },
        }),
      ).toBe(1);
    });

    it("refuses an end user another person's attachment with 403 (Q14)", async () => {
      const { developer, requester, ticket } = await setUp();
      const row = await attachment(developer.user, { ticketId: ticket.id });

      const res = await remove(requester, row.id);

      expect(res.status).toBe(403);
      expect((res.body as ProblemDetails).code).toBe('request.forbidden');
      expect(await ticketIdOf(row.id)).toBe(ticket.id);
    });
  });

  describe('archived projects (§7.5)', () => {
    it('refuses adding and deleting with 409 and still serves reading and downloading', async () => {
      const { project, developer, requester, ticket } = await setUp({ state: 'archived' });
      const projectManager = await signIn('project_manager', project);
      const row = await attachment(requester.user, {
        ticketId: ticket.id,
        status: 'available',
        content: PDF,
      });
      const draft = await attachment(developer.user);

      for (const res of [
        await link(developer, ticket.id, [draft.id]),
        await remove(requester, row.id),
        await remove(projectManager, row.id),
      ]) {
        expect(res.status).toBe(409);
        expect((res.body as ProblemDetails).code).toBe('project.archived');
      }
      expect((await get(requester, `/attachments/${row.id}`)).status).toBe(200);
      expect((await download(developer, row.id)).status).toBe(200);
      expect((await get(developer, `/tickets/${ticket.id}/attachments`)).status).toBe(200);
      // Drafts belong to no project.
      expect((await remove(developer, draft.id)).status).toBe(204);
    });
  });

  describe('POST /api/v1/tickets with attachmentIds (§3.2)', () => {
    function create(account: Account, project: Project, attachmentIds: string[]) {
      return http()
        .post('/api/v1/tickets')
        .set('Authorization', account.authorization)
        .send({ projectId: project.id, title: 'Invoice missing', attachmentIds });
    }

    it('links the drafts to the new ticket without activity events (Q16)', async () => {
      const { project, requester } = await setUp();
      const drafts = [await attachment(requester.user), await attachment(requester.user)];

      const res = await create(
        requester,
        project,
        drafts.map(({ id }) => id),
      );

      expect(res.status).toBe(201);
      const created = res.body as Ticket;
      for (const { id } of drafts) {
        expect(await ticketIdOf(id)).toBe(created.id);
      }
      expect(await events(requester, created.id)).toEqual([]);
      const list = await get(requester, `/tickets/${created.id}/attachments`);
      expect((list.body as AttachmentPage).items.map(({ id }) => id).sort()).toEqual(
        drafts.map(({ id }) => id).sort(),
      );
    });

    it.each([
      ["another person's draft", 404],
      ['an own attachment already linked', 422],
    ] as const)('creates no ticket for %s (%i)', async (_case, status) => {
      const { project, developer, requester, ticket } = await setUp();
      const draft = await attachment(requester.user);
      const refused =
        status === 404
          ? await attachment(developer.user)
          : await attachment(requester.user, { ticketId: ticket.id });
      const before = await prisma.ticket.count({ where: { projectId: project.id } });

      const res = await create(requester, project, [draft.id, refused.id]);

      expect(res.status).toBe(status);
      if (status === 422) {
        expect((res.body as ProblemDetails).errors).toEqual([
          { pointer: '/attachmentIds/1', code: 'field.invalid' },
        ]);
      }
      expect(await prisma.ticket.count({ where: { projectId: project.id } })).toBe(before);
      expect(await ticketIdOf(draft.id)).toBeNull();
    });
  });
});
