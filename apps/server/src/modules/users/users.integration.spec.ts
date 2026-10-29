import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createProductTourProgress } from '../../../test/factories/product-tour-progress.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { AuthenticationModule } from '../../platform/authentication/authentication.module.js';
import { AuthorizationModule } from '../../platform/authorization/authorization.module.js';
import { ConfigModule } from '../../platform/config/config.module.js';
import { DatabaseModule } from '../../platform/database/database.module.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { ErrorsModule } from '../../platform/errors/errors.module.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';
import { HttpModule } from '../../platform/http/http.module.js';
import { LoggingModule } from '../../platform/logging/logging.module.js';
import { administrationAbilities } from '../administration/administration.abilities.js';
import { organizationsAbilities } from '../organizations/organizations.abilities.js';
import { projectsAbilities } from '../projects/projects.abilities.js';
import { UsersModule } from './users.module.js';

describe('users endpoints', () => {
  const config = integrationConfig();
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(config),
        LoggingModule.forRoot(),
        DatabaseModule,
        ErrorsModule,
        HttpModule,
        AuthenticationModule,
        AuthorizationModule.forRoot({
          rules: [administrationAbilities, projectsAbilities, organizationsAbilities],
          restrictions: [],
        }),
        UsersModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
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

  async function signIn() {
    const user = await createUser(prisma, { keycloakUserId: randomUUID() });
    const token = await signAccessToken(config, { sub: user.keycloakUserId ?? '' });
    return { user, authorization: `Bearer ${token}` };
  }

  it('returns the account of the token subject', async () => {
    const user = await createUser(prisma, { keycloakUserId: randomUUID() });
    const token = await signAccessToken(config, { sub: user.keycloakUserId ?? '' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      kind: 'end_user',
      language: user.language,
      timeZone: 'Europe/Warsaw',
      allowedActions: [],
    });
  });

  it('allows an Administrator to open the Administrator panel', async () => {
    const user = await createUser(prisma, {
      kind: 'team',
      isAdmin: true,
      keycloakUserId: randomUUID(),
    });
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: ['pwd', 'otp'],
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body).toMatchObject({
      kind: 'team',
      allowedActions: ['open_administration', 'create_project', 'create_organization'],
    });
  });

  it('requires a signed-in account', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/users/me');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'authentication.required' });
  });

  describe('product tour progress', () => {
    it('lists only the progress of the signed-in person', async () => {
      const { user, authorization } = await signIn();
      const other = await createUser(prisma);
      await createProductTourProgress(prisma, user.id, {
        tourId: 'first_login',
        tourVersion: 2,
        status: 'skipped',
      });
      await createProductTourProgress(prisma, other.id, { tourId: 'first_login' });
      // A tour removed from the closed list is kept but not returned.
      await createProductTourProgress(prisma, user.id, { tourId: 'removed_tour' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me/product-tours')
        .set('Authorization', authorization);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        items: [
          {
            tourId: 'first_login',
            tourVersion: 2,
            status: 'skipped',
            updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.+Z$/) as unknown,
          },
        ],
        nextCursor: null,
      });
    });

    it('records a tour and replaces the record on the next end of it', async () => {
      const { user, authorization } = await signIn();
      const put = (body: object) =>
        request(app.getHttpServer())
          .put('/api/v1/users/me/product-tours/first_login')
          .set('Authorization', authorization)
          .send(body);

      const skipped = await put({ tourVersion: 1, status: 'skipped' });
      const completed = await put({ tourVersion: 2, status: 'completed' });

      expect(skipped.status).toBe(200);
      expect(skipped.body).toMatchObject({
        tourId: 'first_login',
        tourVersion: 1,
        status: 'skipped',
      });
      expect(completed.status).toBe(200);
      expect(completed.body).toMatchObject({ tourVersion: 2, status: 'completed' });
      expect(
        await prisma.productTourProgress.findMany({
          where: { userId: user.id },
          select: { tourId: true, tourVersion: true, status: true },
        }),
      ).toEqual([{ tourId: 'first_login', tourVersion: 2, status: 'completed' }]);
    });

    it.each([
      ['an unknown tour', 'unknown_tour', { tourVersion: 1, status: 'completed' }, '/tourId'],
      [
        'an invalid version',
        'first_login',
        { tourVersion: 0, status: 'completed' },
        '/tourVersion',
      ],
      ['an unknown status', 'first_login', { tourVersion: 1, status: 'started' }, '/status'],
    ])('rejects %s with 422', async (_case, tourId, body, pointer) => {
      const { authorization } = await signIn();

      const res = await request(app.getHttpServer())
        .put(`/api/v1/users/me/product-tours/${tourId}`)
        .set('Authorization', authorization)
        .send(body);

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        code: 'request.validation_failed',
        errors: [expect.objectContaining({ pointer }) as unknown],
      });
    });

    it('requires a signed-in account', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/users/me/product-tours/first_login')
        .send({ tourVersion: 1, status: 'completed' });

      expect(res.status).toBe(401);
    });
  });
});
