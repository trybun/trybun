import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';
import { ApiModule } from '../../api.module.js';
import { loadConfig } from '../config/load-config.js';
import { API_PREFIX, UNPREFIXED_ROUTES } from './api-prefix.js';
import { createOpenApiDocument } from './openapi.js';

describe('OpenAPI document', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiModule.forRoot(loadConfig(TEST_ENV))],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX, { exclude: UNPREFIXED_ROUTES });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // The committed document is the source of the typed client of the web application (§14.2);
  // `pnpm api:generate` writes it again after a change of the endpoints.
  it('is committed in its current version', async () => {
    const document = `${JSON.stringify(createOpenApiDocument(app), undefined, 2)}\n`;

    await expect(document).toMatchFileSnapshot('../../../openapi.json');
  });
});
