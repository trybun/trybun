// The upload of attachments into quarantine (§13.3, ADR 0008, S1-08 step 5) against PostgreSQL and
// SeaweedFS of the global set-up.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AttachmentList } from '@trybun/contracts/attachments';
import type { ProblemDetails } from '@trybun/contracts/problem-details';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createAttachment } from '../../../test/factories/attachment.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { zipArchive } from '../../../test/files/zip.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { ApiModule } from '../../api.module.js';
import type { User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
  QUARANTINE_PREFIX,
  quarantineKey,
} from '../../platform/storage/object-storage.js';
import { ATTACHMENT_UPLOADED } from './attachments.events.js';
import { MAX_DRAFT_BYTES } from './domain/draft-quota.js';

/** A PNG image of 1 × 1 pixel. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const HTML = Buffer.from('<!doctype html><html><body><script>alert(1)</script></body></html>');
const PDF = Buffer.from(
  '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
);
const ENCRYPTED_PDF = Buffer.from(
  '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n' +
    '2 0 obj\n<< /Filter /Standard /V 2 /R 3 /O <00> /U <00> /P -4 >>\nendobj\n' +
    'trailer\n<< /Root 1 0 R /Encrypt 2 0 R >>\n%%EOF\n',
);
const ZIP = zipArchive([{ name: 'notes.txt', content: Buffer.from('notes') }]);
const ENCRYPTED_ZIP = zipArchive([
  { name: 'readme.txt', content: Buffer.from('readme') },
  { name: 'secret.txt', content: Buffer.from('secret'), isEncrypted: true },
]);
const MB = 1024 * 1024;

interface UploadFile {
  name: string;
  content: Buffer;
  /** The type the client declares; the API ignores it (§13.3). */
  type?: string;
}

describe('POST /api/v1/attachments', () => {
  const baseConfig = integrationConfig();
  // A bucket of its own, so the objects other test files store never show here.
  const config = {
    ...baseConfig,
    storage: { ...baseConfig.storage, bucket: 'attachment-uploads' },
  };
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

  async function signIn(kind: 'team' | 'end_user' = 'end_user') {
    const user = await createUser(prisma, { keycloakUserId: randomUUID(), kind });
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: kind === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
    });
    return { user, authorization: `Bearer ${token}` };
  }

  function upload(authorization: string | undefined, files: readonly UploadFile[]) {
    const req = request(app.getHttpServer()).post('/api/v1/attachments');
    if (authorization !== undefined) {
      req.set('Authorization', authorization);
    }
    for (const { name, content, type } of files) {
      req.attach('files', content, { filename: name, contentType: type ?? 'image/png' });
    }
    return req;
  }

  /** The keys of every object in quarantine. */
  async function quarantinedKeys(): Promise<string[]> {
    const keys: string[] = [];
    for await (const { key } of storage.list(QUARANTINE_PREFIX)) {
      keys.push(key);
    }
    return keys.sort();
  }

  /** Runs a request and checks that it leaves no object behind (all or nothing, Q6). */
  async function withoutNewObjects<T>(send: () => PromiseLike<T>): Promise<T> {
    const before = await quarantinedKeys();
    const result = await send();
    expect(await quarantinedKeys()).toEqual(before);
    return result;
  }

  async function drafts(user: User) {
    return prisma.attachment.findMany({ where: { uploadedById: user.id }, orderBy: { id: 'asc' } });
  }

  it('stores files as drafts in quarantine with their outbox events', async () => {
    const { user, authorization } = await signIn();

    const res = await upload(authorization, [
      { name: ' screenshot.PNG ', content: PNG, type: 'text/html' },
      // A decomposed "ó", composed to NFC; a path separator.
      {
        name: 'Zażo\u0301łć\\raport.csv',
        content: Buffer.from('id;name\n1;Gęś\n'),
        type: 'image/png',
      },
    ]);

    expect(res.status).toBe(201);
    const { items } = res.body as AttachmentList;
    expect(items).toEqual([
      {
        id: expect.any(String) as string,
        fileName: 'screenshot.PNG',
        // The type of the allowlist entry, never the client's (§13.3).
        contentType: 'image/png',
        size: PNG.length,
        isImage: true,
        status: 'quarantine',
        ticketId: null,
        uploadedBy: { id: user.id, displayName: user.displayName },
        createdAt: expect.any(String) as string,
        allowedActions: ['read', 'delete'],
      },
      expect.objectContaining({
        fileName: 'Zażółć_raport.csv',
        contentType: 'text/csv; charset=utf-8',
        isImage: false,
      }),
    ]);
    const ids = items.map(({ id }) => id);
    expect((await drafts(user)).map(({ id, status }) => ({ id, status }))).toEqual(
      ids.map((id) => ({ id, status: 'quarantine' })).sort((a, b) => a.id.localeCompare(b.id)),
    );
    const events = await prisma.outboxEvent.findMany({
      where: { OR: ids.map((attachmentId) => ({ payload: { equals: { attachmentId } } })) },
      select: { type: true, payload: true },
    });
    expect(events).toEqual(
      expect.arrayContaining(
        ids.map((attachmentId) => ({ type: ATTACHMENT_UPLOADED, payload: { attachmentId } })),
      ),
    );
    expect(events).toHaveLength(ids.length);
    const stored = await storage.head(quarantineKey(ids[0] ?? ''));
    expect(stored?.size).toBe(PNG.length);
  });

  it.each([
    ['an HTML file renamed to .png', { name: 'invoice.png', content: HTML }],
    ['a PNG image renamed to .pdf', { name: 'invoice.pdf', content: PNG }],
    ['an extension outside the allowlist', { name: 'page.html', content: HTML }],
    ['a file without extension', { name: 'README', content: Buffer.from('text') }],
    ['an encrypted ZIP archive', { name: 'archive.zip', content: ENCRYPTED_ZIP }],
    ['an encrypted PDF file', { name: 'scan.pdf', content: ENCRYPTED_PDF }],
    ['a binary .csv file', { name: 'export.csv', content: Buffer.from([0x50, 0x4b, 0x00, 0xff]) }],
    ['an image as .csv file', { name: 'export.csv', content: PNG }],
    ['invalid UTF-8 as .txt file', { name: 'notes.txt', content: Buffer.from([0x61, 0xc3, 0x28]) }],
    ['invalid JSON', { name: 'data.json', content: Buffer.from('{"a": [1, 2}') }],
  ])('rejects %s with attachment.type_not_allowed', async (_case, file) => {
    const { user, authorization } = await signIn();

    const res = await withoutNewObjects(() => upload(authorization, [file]));

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'attachment.type_not_allowed',
      errors: [{ pointer: '/files/0', code: 'field.invalid' }],
    } satisfies Partial<ProblemDetails>);
    expect(await drafts(user)).toEqual([]);
  });

  it.each([
    ['a ZIP archive', { name: 'archive.zip', content: ZIP }, 'application/zip'],
    ['a PDF file', { name: 'scan.pdf', content: PDF }, 'application/pdf'],
    [
      'a valid CSV file',
      { name: 'export.csv', content: Buffer.from('a,b\n1,2\n') },
      'text/csv; charset=utf-8',
    ],
    [
      'a text file with a byte order mark',
      { name: 'server.log', content: Buffer.from('﻿started\n') },
      'text/plain; charset=utf-8',
    ],
    [
      'valid JSON',
      { name: 'data.json', content: Buffer.from('{"a": [1, 2]}') },
      'application/json',
    ],
  ])('accepts %s', async (_case, file, contentType) => {
    const { authorization } = await signIn();

    const res = await upload(authorization, [file]);

    expect(res.status).toBe(201);
    expect((res.body as AttachmentList).items).toMatchObject([{ contentType, isImage: false }]);
  });

  it('rejects the whole upload when one file is rejected and keeps none of its objects', async () => {
    const { user, authorization } = await signIn();

    const res = await withoutNewObjects(() =>
      upload(authorization, [
        { name: 'first.png', content: PNG },
        { name: 'second.png', content: HTML },
        { name: 'third.png', content: PNG },
      ]),
    );

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ errors: [{ pointer: '/files/1', code: 'field.invalid' }] });
    expect(await drafts(user)).toEqual([]);
  });

  it(
    'stops a file over the size limit with 413 and keeps no object',
    { timeout: 30_000 },
    async () => {
      const { user, authorization } = await signIn();

      const res = await withoutNewObjects(() =>
        upload(authorization, [
          { name: 'small.png', content: PNG },
          { name: 'large.txt', content: Buffer.alloc(26 * MB, 'a') },
        ]),
      );

      expect(res.status).toBe(413);
      expect(res.body).toMatchObject({ code: 'request.too_large' });
      expect(await drafts(user)).toEqual([]);
    },
  );

  it('refuses 11 files with array.too_long and keeps no object', async () => {
    const { user, authorization } = await signIn();
    const files = Array.from({ length: 11 }, (_, index) => ({
      name: `image-${index}.png`,
      content: PNG,
    }));

    const res = await withoutNewObjects(() => upload(authorization, files));

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'request.validation_failed',
      errors: [{ pointer: '/files', code: 'array.too_long' }],
    });
    expect(await drafts(user)).toEqual([]);
  });

  it.each([
    ['no file', () => request(app.getHttpServer()).post('/api/v1/attachments').field('x', '')],
    [
      'a body that is not multipart',
      () => request(app.getHttpServer()).post('/api/v1/attachments').send({}),
    ],
  ])('refuses %s with 422', async (_case, send) => {
    const { authorization } = await signIn();

    const res = await send().set('Authorization', authorization);

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'request.validation_failed' });
  });

  it('refuses a file in another field', async () => {
    const { authorization } = await signIn();

    const res = await withoutNewObjects(() =>
      request(app.getHttpServer())
        .post('/api/v1/attachments')
        .set('Authorization', authorization)
        .attach('file', PNG, 'image.png'),
    );

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ errors: [{ pointer: '/file', code: 'field.unrecognized' }] });
  });

  describe('the draft quota (Q23)', () => {
    async function createDrafts(user: User, count: number, size = 1) {
      for (let index = 0; index < count; index += 1) {
        await createAttachment(prisma, { uploadedById: user.id, size });
      }
    }

    it('refuses the 51st draft with attachment.draft_limit_reached', async () => {
      const { user, authorization } = await signIn();
      await createDrafts(user, 49);
      // Linked attachments and the drafts of others do not count.
      const { user: other } = await signIn();
      await createDrafts(other, 2);

      const fiftieth = await upload(authorization, [{ name: 'fiftieth.png', content: PNG }]);
      const fiftyFirst = await withoutNewObjects(() =>
        upload(authorization, [{ name: 'fifty-first.png', content: PNG }]),
      );

      expect(fiftieth.status).toBe(201);
      expect(fiftyFirst.status).toBe(422);
      expect(fiftyFirst.body).toMatchObject({
        code: 'attachment.draft_limit_reached',
        errors: [{ pointer: '/files', code: 'field.invalid' }],
      });
    });

    it('refuses an upload whose files exceed the number of drafts left', async () => {
      const { user, authorization } = await signIn();
      await createDrafts(user, 49);

      const res = await withoutNewObjects(() =>
        upload(authorization, [
          { name: 'one.png', content: PNG },
          { name: 'two.png', content: PNG },
        ]),
      );

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'attachment.draft_limit_reached' });
      expect(await drafts(user)).toHaveLength(49);
    });

    it('stops a file beyond the remaining bytes while it streams', async () => {
      const { user, authorization } = await signIn();
      await createAttachment(prisma, { uploadedById: user.id, size: MAX_DRAFT_BYTES - 10 });
      // Removed files keep no object, so their bytes do not count.
      await createAttachment(prisma, { uploadedById: user.id, size: 25 * MB, status: 'infected' });

      const res = await withoutNewObjects(() =>
        upload(authorization, [{ name: 'notes.txt', content: Buffer.alloc(11, 'a') }]),
      );
      const fitting = await upload(authorization, [
        { name: 'notes.txt', content: Buffer.alloc(10, 'a') },
      ]);

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'attachment.draft_limit_reached' });
      expect(fitting.status).toBe(201);
    });

    it('lets parallel uploads of one person never pass the quota together', async () => {
      const { user, authorization } = await signIn();
      await createDrafts(user, 47);
      const existing = new Set((await drafts(user)).map(({ id }) => id));
      const before = new Set(await quarantinedKeys());

      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          upload(authorization, [{ name: `parallel-${index}.png`, content: PNG }]),
        ),
      );

      expect(responses.map(({ status }) => status).sort()).toEqual([201, 201, 201, 422, 422]);
      for (const response of responses.filter(({ status }) => status === 422)) {
        expect(response.body).toMatchObject({ code: 'attachment.draft_limit_reached' });
      }
      const uploaded = (await drafts(user)).filter(({ id }) => !existing.has(id));
      expect(uploaded).toHaveLength(3);
      // The refused uploads keep no object.
      const added = (await quarantinedKeys()).filter((key) => !before.has(key));
      expect(added).toEqual(uploaded.map(({ id }) => quarantineKey(id)).sort());
    });
  });

  it('answers a request without a session with 401', async () => {
    const res = await upload(undefined, [{ name: 'image.png', content: PNG }]);

    expect(res.status).toBe(401);
  });
});
