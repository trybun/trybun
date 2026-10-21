import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { join } from 'node:path';
import { Body, Controller, type INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import openapiTS, { astToString } from 'openapi-typescript';
import request from 'supertest';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { z } from 'zod';
import { API_PREFIX } from './api-prefix.js';
import { HttpModule } from './http.module.js';
import { createOpenApiDocument } from './openapi.js';
import { ResponseSchema } from './response-schema.decorator.js';

// Verification endpoint of the NestJS 12 Standard Schema approach (S0-01, ADR 0002).
const createNoteSchema = z.object({ title: z.string().min(1).max(10) });
const noteSchema = z.object({ id: z.string(), title: z.string() });

let response: Record<string, unknown> = {};

@Controller('notes')
class NotesController {
  @Post()
  @ResponseSchema(noteSchema, 201)
  create(@Body({ schema: createNoteSchema }) body: z.infer<typeof createNoteSchema>) {
    return { ...response, title: body.title };
  }
}

describe('HttpModule', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HttpModule],
      controllers: [NotesController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 422 with errors[] for an invalid body', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/notes')
      .send({ title: 'longer than ten' });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      type: 'about:blank',
      title: 'Unprocessable Content',
      status: 422,
      code: 'request.validation_failed',
      errors: [{ pointer: '/title', code: 'string.too_long' }],
    });
  });

  it('never sends a field outside the response schema', async () => {
    response = { id: 'n1', passwordHash: 'secret' };

    const res = await request(app.getHttpServer()).post('/api/v1/notes').send({ title: 'Hello' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'n1', title: 'Hello' });
  });

  it('returns 500 for a response that does not match its schema', async () => {
    response = {};

    const res = await request(app.getHttpServer()).post('/api/v1/notes').send({ title: 'Hello' });

    expect(res.status).toBe(500);
  });

  it('describes the request and the response in the OpenAPI document', () => {
    const operation = createOpenApiDocument(app).paths['/api/v1/notes']?.post;

    expect(operation?.requestBody).toMatchObject({
      content: {
        'application/json': {
          schema: { properties: { title: { type: 'string', minLength: 1, maxLength: 10 } } },
        },
      },
    });
    expect(operation?.responses['201']).toMatchObject({
      content: {
        'application/json': {
          schema: { properties: { id: { type: 'string' }, title: { type: 'string' } } },
        },
      },
    });
  });

  it('generates openapi-typescript types that compile with openapi-fetch', async () => {
    const document = createOpenApiDocument(app);
    const types = astToString(await openapiTS(document as Parameters<typeof openapiTS>[0]));
    // Inside the package, so that the generated client resolves openapi-fetch from node_modules.
    const cache = join(import.meta.dirname, '../../../node_modules/.cache');
    await mkdir(cache, { recursive: true });
    const dir = await mkdtemp(join(cache, 'openapi-'));
    await writeFile(join(dir, 'package.json'), '{ "type": "module" }');
    await writeFile(join(dir, 'schema.ts'), types);
    await writeFile(
      join(dir, 'client.ts'),
      [
        "import createClient from 'openapi-fetch';",
        "import type { paths } from './schema.js';",
        "const client = createClient<paths>({ baseUrl: 'http://localhost' });",
        "const { data } = await client.POST('/api/v1/notes', { body: { title: 'Hello' } });",
        'export const id: string | undefined = data?.id;',
        '// @ts-expect-error: the response has no such field',
        'export const hash = data?.passwordHash;',
      ].join('\n'),
    );

    onTestFinished(() => rm(dir, { recursive: true }));

    const program = ts.createProgram([join(dir, 'client.ts')], {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2024,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      types: [],
    });
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));

    expect(diagnostics).toEqual([]);
  });
});
