import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';
import { ApiModule } from '../../api.module.js';
import { loadConfig } from '../config/load-config.js';
import { API_PREFIX, UNPREFIXED_ROUTES } from '../http/api-prefix.js';
import { createOpenApiDocument } from '../http/openapi.js';

describe('HealthController', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const config = loadConfig(TEST_ENV);
    const moduleRef = await Test.createTestingModule({
      imports: [ApiModule.forRoot(config)],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX, { exclude: UNPREFIXED_ROUTES });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports liveness on /health outside the API prefix', async () => {
    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('is not reachable through the BFF path', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');

    expect(res.status).toBe(404);
  });

  it('is not part of the public OpenAPI document', () => {
    expect(Object.keys(createOpenApiDocument(app).paths)).not.toContain('/health');
  });
});
