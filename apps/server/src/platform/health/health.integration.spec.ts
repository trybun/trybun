import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type StartedValkeyContainer, ValkeyContainer } from '@testcontainers/valkey';
import request from 'supertest';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';
import { VALKEY_IMAGE } from '../../../test/setup/containers.js';
import { ApiModule } from '../../api.module.js';
import { loadConfig } from '../config/load-config.js';
import { API_PREFIX, UNPREFIXED_ROUTES } from '../http/api-prefix.js';

/** An address where nothing listens. */
const CLOSED_PORT_URL = 'postgresql://trybun@127.0.0.1:1/trybun';

async function startApi(env: Record<string, string>): Promise<INestApplication<Server>> {
  const moduleRef = await Test.createTestingModule({
    imports: [ApiModule.forRoot(loadConfig({ ...TEST_ENV, ...env }))],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<Server>>({ logger: false });
  app.setGlobalPrefix(API_PREFIX, { exclude: UNPREFIXED_ROUTES });
  return app.init();
}

describe('/health/ready', () => {
  const apps: INestApplication[] = [];
  let valkey: StartedValkeyContainer | undefined;

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
    await valkey?.stop();
  });

  it('stays ready when Valkey goes down and reports it as degraded', async () => {
    valkey = await new ValkeyContainer(VALKEY_IMAGE).start();
    const app = await startApi({
      DATABASE_URL: inject('databaseUrl'),
      TRYBUN_VALKEY_URL: valkey.getConnectionUrl(),
    });
    apps.push(app);

    const before = await request(app.getHttpServer()).get('/health/ready');
    expect(before.status).toBe(200);
    expect(before.body).toEqual({ status: 'ok', database: 'ok', valkey: 'ok' });

    await valkey.stop();
    valkey = undefined;

    const after = await request(app.getHttpServer()).get('/health/ready');
    expect(after.status).toBe(200);
    expect(after.body).toEqual({ status: 'degraded', database: 'ok', valkey: 'degraded' });
    // Liveness never depends on a dependency.
    expect((await request(app.getHttpServer()).get('/health')).status).toBe(200);
  });

  it('fails when PostgreSQL is unavailable', async () => {
    const app = await startApi({
      DATABASE_URL: CLOSED_PORT_URL,
      TRYBUN_VALKEY_URL: inject('valkeyUrl'),
    });
    apps.push(app);

    const res = await request(app.getHttpServer()).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 503, code: 'server.unavailable' });
    expect((await request(app.getHttpServer()).get('/health')).status).toBe(200);
  });
});
