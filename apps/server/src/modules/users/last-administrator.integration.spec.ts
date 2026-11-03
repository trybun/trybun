// The rule of the last active Administrator (§7.4) depends on every account of the system, so it
// has a database of its own: the other test files create Administrators in parallel (§18.7).
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
import { createUser } from '../../../test/factories/user.factory.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { createOwnDatabase } from '../../../test/setup/own-database.js';
import { AuthenticationModule } from '../../platform/authentication/authentication.module.js';
import { AuthorizationModule } from '../../platform/authorization/authorization.module.js';
import { ClockModule } from '../../platform/clock/clock.module.js';
import type { TrybunConfig } from '../../platform/config/config.schema.js';
import { ConfigModule } from '../../platform/config/config.module.js';
import { DatabaseModule } from '../../platform/database/database.module.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { ErrorsModule } from '../../platform/errors/errors.module.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';
import { HttpModule } from '../../platform/http/http.module.js';
import { LoggingModule } from '../../platform/logging/logging.module.js';
import { usersAbilities } from './users.abilities.js';
import { UsersModule } from './users.module.js';

describe('the last active Administrator', () => {
  let config: TrybunConfig;
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  beforeAll(async () => {
    config = { ...integrationConfig(), databaseUrl: await createOwnDatabase() };
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(config),
        LoggingModule.forRoot(),
        ClockModule,
        DatabaseModule,
        ErrorsModule,
        HttpModule,
        AuthenticationModule,
        AuthorizationModule.forRoot({ rules: [usersAbilities], restrictions: [] }),
        UsersModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    mswServer.use(keycloakJwksHandler(config));
    await prisma.user.updateMany({ where: { isAdmin: true }, data: { isAdmin: false } });
  });

  afterAll(async () => {
    await app.close();
  });

  async function signInAsAdministrator() {
    const user = await createUser(prisma, {
      kind: 'team',
      isAdmin: true,
      keycloakUserId: randomUUID(),
    });
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: ['pwd', 'otp'],
    });
    return { user, authorization: `Bearer ${token}` };
  }

  async function activeAdministrators() {
    return prisma.user.count({ where: { isAdmin: true, state: 'active' } });
  }

  it('can be neither deactivated nor demoted, even by themselves', async () => {
    const { user, authorization } = await signInAsAdministrator();
    // A deactivated Administrator does not count.
    await createUser(prisma, { kind: 'team', isAdmin: true, state: 'deactivated' });

    const deactivation = await request(app.getHttpServer())
      .post(`/api/v1/users/${user.id}/deactivation`)
      .set('Authorization', authorization);
    const demotion = await request(app.getHttpServer())
      .delete(`/api/v1/users/${user.id}/administrator-role`)
      .set('Authorization', authorization);

    expect(deactivation.status).toBe(409);
    expect(deactivation.body).toMatchObject({ code: 'user.last_administrator' });
    expect(demotion.status).toBe(409);
    expect(demotion.body).toMatchObject({ code: 'user.last_administrator' });
    expect(await activeAdministrators()).toBe(1);
  });

  it('stays when two Administrators deactivate each other at the same time', async () => {
    const first = await signInAsAdministrator();
    const second = await signInAsAdministrator();

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/users/${second.user.id}/deactivation`)
        .set('Authorization', first.authorization),
      request(app.getHttpServer())
        .post(`/api/v1/users/${first.user.id}/deactivation`)
        .set('Authorization', second.authorization),
    ]);

    // The second change waits for the lock of the first and then finds the last Administrator –
    // or its account is already deactivated when its request is authenticated.
    const statuses = responses.map((res) => res.status).sort();
    expect(statuses[0]).toBe(204);
    expect([401, 409]).toContain(statuses[1]);
    expect(await activeAdministrators()).toBe(1);
  });
});
