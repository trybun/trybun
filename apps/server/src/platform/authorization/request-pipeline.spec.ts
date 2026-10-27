// The order of checks of the request pipeline (§17.2, §18.3) on a verification endpoint: a
// versioned record behind the target record guard, validation, `If-Match` and the conditional
// update. The record access stands in for the abilities of the permission layer (S1-04).
import type { Server } from 'node:http';
import { Body, Controller, type INestApplication, Param, Patch } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { TEST_ENV } from '../../../test/env.js';
import { ConfigModule } from '../config/config.module.js';
import { loadConfig } from '../config/load-config.js';
import { assertVersionMatched } from '../database/optimistic-locking.js';
import { ErrorsModule } from '../errors/errors.module.js';
import { API_PREFIX } from '../http/api-prefix.js';
import { ExpectedVersion } from '../http/expected-version.decorator.js';
import { HttpModule } from '../http/http.module.js';
import { ResponseSchema } from '../http/response-schema.decorator.js';
import { LoggingModule } from '../logging/logging.module.js';
import { AuthorizationModule } from './authorization.module.js';
import {
  RecordAccess,
  type RecordAccessDecision,
  type TargetRecord as Target,
} from './record-access.js';
import { TargetRecord } from './target-record.decorator.js';

const VISIBLE = '0190f2f4-7c1e-7000-8000-000000000001';
const INVISIBLE = '0190f2f4-7c1e-7000-8000-000000000002';
const READ_ONLY = '0190f2f4-7c1e-7000-8000-000000000003';

const updateNoteSchema = z.object({ title: z.string().min(1).max(10) });
const noteSchema = z.object({ id: z.string(), title: z.string(), version: z.number().int() });

const notes = new Map<string, z.infer<typeof noteSchema>>();

class TestRecordAccess extends RecordAccess {
  decide(_principal: unknown, target: Target): Promise<RecordAccessDecision> {
    const decisions: Record<string, RecordAccessDecision> = {
      [VISIBLE]: { outcome: 'allowed' },
      [READ_ONLY]: { outcome: 'denied', code: 'request.forbidden' },
    };
    return Promise.resolve(decisions[target.id] ?? { outcome: 'not_found' });
  }
}

@Controller('notes')
class NotesController {
  @Patch(':noteId')
  @TargetRecord({ subject: 'Note', param: 'noteId', action: 'update' })
  @ResponseSchema(noteSchema)
  update(
    @Param('noteId', { schema: z.uuid() }) noteId: string,
    @Body({ schema: updateNoteSchema }) body: z.infer<typeof updateNoteSchema>,
    @ExpectedVersion() version: number,
  ) {
    // The conditional update of `platform/database` on an in-memory record.
    const note = notes.get(noteId);
    const isCurrent = note?.version === version;
    assertVersionMatched({ count: isCurrent ? 1 : 0 });
    const updated = { id: noteId, title: body.title, version: version + 1 };
    notes.set(noteId, updated);
    return updated;
  }
}

describe('request pipeline', () => {
  let app: INestApplication<Server>;

  function patch(id: string, body: object, ifMatch?: string) {
    const req = request(app.getHttpServer()).patch(`/api/v1/notes/${id}`).send(body);
    return ifMatch === undefined ? req : req.set('If-Match', ifMatch);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(loadConfig(TEST_ENV)),
        LoggingModule.forRoot(),
        ErrorsModule,
        HttpModule,
        AuthorizationModule.forRoot({ rules: [], restrictions: [] }),
      ],
      controllers: [NotesController],
    })
      .overrideProvider(RecordAccess)
      .useClass(TestRecordAccess)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  beforeEach(() => {
    notes.set(VISIBLE, { id: VISIBLE, title: 'Old', version: 3 });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['a valid change', { title: 'New' }, 'W/"3"'],
    ['an invalid body', { title: 'longer than ten' }, 'W/"3"'],
    ['no If-Match', { title: 'New' }, undefined],
    ['a stale If-Match', { title: 'New' }, 'W/"2"'],
  ])('returns 404 for an invisible record with %s', async (_case, body, ifMatch) => {
    const res = await patch(INVISIBLE, body, ifMatch);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'request.not_found',
    });
  });

  it('returns 404 for a path parameter that is no record ID', async () => {
    const res = await patch('KEY-1', { title: 'New' }, 'W/"3"');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'request.not_found' });
  });

  it('returns 403 for a visible record on which the action is not permitted', async () => {
    const res = await patch(READ_ONLY, { title: 'longer than ten' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ status: 403, code: 'request.forbidden' });
  });

  it('returns 422 with the invalid fields for a visible record', async () => {
    const res = await patch(VISIBLE, { title: 'longer than ten' }, 'W/"3"');

    expect(res.status).toBe(422);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toEqual({
      type: 'about:blank',
      title: 'Unprocessable Content',
      status: 422,
      code: 'request.validation_failed',
      errors: [{ pointer: '/title', code: 'string.too_long' }],
    });
  });

  it.each([
    ['no If-Match', undefined],
    ['If-Match: *', '*'],
  ])('returns 428 for an update with %s', async (_case, ifMatch) => {
    const res = await patch(VISIBLE, { title: 'New' }, ifMatch);

    expect(res.status).toBe(428);
    expect(res.body).toMatchObject({ status: 428, code: 'request.precondition_required' });
  });

  it.each([
    ['a stale version', 'W/"2"'],
    ['a value that is no version', '"abc"'],
  ])('returns 412 for an update with %s', async (_case, ifMatch) => {
    const res = await patch(VISIBLE, { title: 'New' }, ifMatch);

    expect(res.status).toBe(412);
    expect(res.body).toMatchObject({ status: 412, code: 'request.precondition_failed' });
    expect(notes.get(VISIBLE)?.version).toBe(3);
  });

  it('changes the record with the current version and returns the new one as ETag', async () => {
    const res = await patch(VISIBLE, { title: 'New' }, 'W/"3"');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: VISIBLE, title: 'New', version: 4 });
    expect(res.headers.etag).toBe('W/"4"');
  });

  it('returns 404 with Problem Details for an unknown route', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/unknown');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'request.not_found' });
  });

  it('returns 400 for a body that is not JSON', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/notes/${VISIBLE}`)
      .set('Content-Type', 'application/json')
      .set('If-Match', 'W/"3"')
      .send('{"title":');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'request.malformed' });
  });
});
