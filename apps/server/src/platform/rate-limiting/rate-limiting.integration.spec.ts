// Rate limiting of the API (§14.4) with `@nestjs/throttler` and the storage of
// `@nest-lab/throttler-storage-redis` on a real Valkey: the storage declares no NestJS 12 support
// yet, so this test covers the combination (ADR 0007).
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { captureLogs } from '../../../test/logging/captured-logs.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { AuthenticationModule } from '../authentication/authentication.module.js';
import { Public } from '../authentication/public.decorator.js';
import { ConfigModule } from '../config/config.module.js';
import type { TrybunConfig } from '../config/config.schema.js';
import { DatabaseModule } from '../database/database.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { ErrorsModule } from '../errors/errors.module.js';
import { API_PREFIX } from '../http/api-prefix.js';
import { HttpModule } from '../http/http.module.js';
import { TRUSTED_PROXIES } from '../http/trusted-proxies.js';
import { LOG_DESTINATION, LoggingModule } from '../logging/logging.module.js';
import { RateLimitingModule } from './rate-limiting.module.js';
import { SkipRateLimit } from './skip-rate-limit.decorator.js';

@Controller('probes')
class ProbesController {
  @Get('first')
  first(): string {
    return 'first';
  }

  @Get('second')
  second(): string {
    return 'second';
  }

  @Public()
  @Get('public')
  public(): string {
    return 'public';
  }

  @Public()
  @SkipRateLimit()
  @Get('unlimited')
  unlimited(): string {
    return 'unlimited';
  }
}

/** A documentation address (RFC 5737) per test, so the counters of the tests never meet. */
function clientIp(): string {
  return `203.0.113.${String(Math.floor(Math.random() * 254) + 1)}`;
}

describe('rate limiting', () => {
  // nestjs-pino builds its logger once per process: one destination for every app of the file.
  const logs = captureLogs();

  async function start(config: TrybunConfig): Promise<INestApplication<Server>> {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ...config, logLevel: 'warn' }),
        LoggingModule.forRoot(),
        DatabaseModule,
        ErrorsModule,
        HttpModule,
        AuthenticationModule,
        RateLimitingModule,
      ],
      controllers: [ProbesController],
    })
      .overrideProvider(LOG_DESTINATION)
      .useValue(logs)
      .compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix(API_PREFIX);
    app.set('trust proxy', TRUSTED_PROXIES);
    await app.init();
    return app;
  }

  describe('with Valkey', () => {
    let config: TrybunConfig;
    let app: INestApplication<Server>;

    beforeAll(async () => {
      config = integrationConfig();
      app = await start(config);
      mswServer.use(keycloakJwksHandler(config));
    });

    afterAll(async () => {
      await app.close();
    });

    async function signIn(): Promise<string> {
      const user = await createUser(app.get(PrismaService), { keycloakUserId: randomUUID() });
      return `Bearer ${await signAccessToken(config, { sub: user.keycloakUserId ?? '' })}`;
    }

    it('refuses the 101st request of a user in a minute with 429 and the RateLimit headers', async () => {
      const authorization = await signIn();
      const server = app.getHttpServer();

      for (let index = 1; index <= 100; index += 1) {
        // The counter is the user's, for all endpoints together.
        const res = await request(server)
          .get(`/api/v1/probes/${index % 2 === 0 ? 'first' : 'second'}`)
          .set('Authorization', authorization);
        expect(res.status).toBe(200);
        expect(res.headers['ratelimit-policy']).toBe('"user";q=100;w=60');
        expect(res.headers.ratelimit).toMatch(
          new RegExp(`^"user";r=${String(100 - index)};t=\\d+$`),
        );
      }
      const refused = await request(server)
        .get('/api/v1/probes/first')
        .set('Authorization', authorization);

      expect(refused.status).toBe(429);
      expect(refused.body).toMatchObject({ status: 429, code: 'request.rate_limited' });
      expect(refused.headers['ratelimit-policy']).toBe('"user";q=100;w=60');
      expect(refused.headers.ratelimit).toMatch(/^"user";r=0;t=\d+$/);
      expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
      expect(Number(refused.headers['retry-after'])).toBeLessThanOrEqual(60);
    });

    it('keeps a counter per user', async () => {
      const [first, second] = await Promise.all([signIn(), signIn()]);
      const server = app.getHttpServer();
      for (let index = 0; index < 100; index += 1) {
        await request(server).get('/api/v1/probes/first').set('Authorization', first);
      }

      const res = await request(server).get('/api/v1/probes/first').set('Authorization', second);

      expect(res.status).toBe(200);
      expect(res.headers.ratelimit).toMatch(/^"user";r=99;t=\d+$/);
    });

    it('limits a public endpoint to 20 requests per minute per client IP', async () => {
      const ip = clientIp();
      const server = app.getHttpServer();
      for (let index = 0; index < 20; index += 1) {
        const res = await request(server).get('/api/v1/probes/public').set('X-Forwarded-For', ip);
        expect(res.status).toBe(200);
        expect(res.headers['ratelimit-policy']).toBe('"ip";q=20;w=60');
      }

      const refused = await request(server).get('/api/v1/probes/public').set('X-Forwarded-For', ip);
      const otherClient = await request(server)
        .get('/api/v1/probes/public')
        .set('X-Forwarded-For', '192.0.2.1');

      expect(refused.status).toBe(429);
      expect(refused.body).toMatchObject({ code: 'request.rate_limited' });
      expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
      expect(otherClient.status).toBe(200);
    });

    it('takes the client IP from the nearest address outside the internal network', async () => {
      const ip = clientIp();
      const server = app.getHttpServer();
      // A forged address in front of the one Caddy appended does not create a new counter.
      for (let index = 0; index < 20; index += 1) {
        await request(server)
          .get('/api/v1/probes/public')
          .set('X-Forwarded-For', `198.51.100.${String(index + 1)}, ${ip}, 10.0.0.5`);
      }

      const refused = await request(server)
        .get('/api/v1/probes/public')
        .set('X-Forwarded-For', `198.51.100.99, ${ip}`);

      expect(refused.status).toBe(429);
    });

    it('does not limit an exempt endpoint', async () => {
      const ip = clientIp();
      const server = app.getHttpServer();
      for (let index = 0; index < 25; index += 1) {
        const res = await request(server)
          .get('/api/v1/probes/unlimited')
          .set('X-Forwarded-For', ip);
        expect(res.status).toBe(200);
        expect(res.headers.ratelimit).toBeUndefined();
      }
    });
  });

  describe('without Valkey', () => {
    let app: INestApplication<Server>;

    beforeAll(async () => {
      // A port where nothing listens: Valkey is unavailable.
      app = await start({ ...integrationConfig(), valkeyUrl: 'redis://127.0.0.1:1' });
    });

    afterAll(async () => {
      await app.close();
    });

    it('fails open and logs a warning', async () => {
      const ip = clientIp();
      const server = app.getHttpServer();
      for (let index = 0; index < 25; index += 1) {
        const res = await request(server).get('/api/v1/probes/public').set('X-Forwarded-For', ip);
        expect(res.status).toBe(200);
      }

      expect(logs.lines).toContainEqual(
        expect.objectContaining({
          level: 'warn',
          msg: 'Rate limit skipped: Valkey is unavailable',
        }),
      );
    });
  });
});
