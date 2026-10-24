import type { Server } from 'node:http';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';
import { captureLogs } from '../../../test/logging/captured-logs.js';
import { ConfigModule } from '../config/config.module.js';
import { loadConfig } from '../config/load-config.js';
import { API_PREFIX } from '../http/api-prefix.js';
import { LOG_DESTINATION, LoggingModule } from '../logging/logging.module.js';
import { AppError } from './app-error.js';
import { ErrorsModule } from './errors.module.js';

class DatabaseError extends Error {
  readonly code = 'P2002';
}

@Controller('failures')
class FailuresController {
  @Get('unexpected')
  unexpected() {
    throw new DatabaseError('Unique constraint failed on jane@example.com');
  }

  @Get('expected')
  expected() {
    throw new AppError('request.forbidden');
  }

  @Get('second-factor')
  secondFactor() {
    throw new AppError('authentication.second_factor_required');
  }
}

describe('ProblemDetailsFilter', () => {
  let app: INestApplication<Server>;
  const logs = captureLogs();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(loadConfig({ ...TEST_ENV, TRYBUN_LOG_LEVEL: 'info' })),
        LoggingModule.forRoot(),
        ErrorsModule,
      ],
      controllers: [FailuresController],
    })
      .overrideProvider(LOG_DESTINATION)
      .useValue(logs)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns an unexpected error as 500 without details and logs it once with the request ID', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/failures/unexpected')
      .set('Cookie', 'session=secret');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      code: 'server.internal_error',
    });
    const requestId = res.headers['x-request-id'];
    expect(requestId).toMatch(/^[\da-f-]{36}$/);
    const errors = logs.lines.filter((line) => line.msg === 'Unexpected error');
    expect(errors).toEqual([
      expect.objectContaining({
        level: 'error',
        requestId,
        err: expect.objectContaining({ type: 'DatabaseError', code: 'P2002' }) as unknown,
      }),
    ]);
    // Never the message of the error, the headers or the cookies (§17.2).
    expect(JSON.stringify(logs.lines)).not.toMatch(/jane@example\.com|secret|cookie/i);
  });

  it('logs the completed request with its method, route template and status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/failures/expected?q=search+text')
      .set('X-Request-Id', 'web-request-1');

    expect(res.status).toBe(403);
    expect(res.headers['x-request-id']).toBe('web-request-1');
    expect(logs.lines).toContainEqual(
      expect.objectContaining({
        requestId: 'web-request-1',
        req: { method: 'GET' },
        route: '/api/v1/failures/expected',
        res: { statusCode: 403 },
      }),
    );
    expect(JSON.stringify(logs.lines)).not.toContain('search');
  });

  it('replaces a request ID that is not safe to log', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/failures/expected')
      .set('X-Request-Id', 'a"b\\nc');

    expect(res.headers['x-request-id']).toMatch(/^[\da-f-]{36}$/);
  });

  it.each([
    ['/api/v1/failures/expected', 403, undefined],
    ['/api/v1/failures/second-factor', 401, 'Bearer error="insufficient_user_authentication"'],
  ])('renders %s as Problem Details', async (path, status, challenge) => {
    const res = await request(app.getHttpServer()).get(path);

    expect(res.status).toBe(status);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.headers['www-authenticate']).toBe(challenge);
  });
});
