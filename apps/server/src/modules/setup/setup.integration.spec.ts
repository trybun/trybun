import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser } from '../../../test/factories/user.factory.js';
import { keycloakAdminFake, type KeycloakAdminFake } from '../../../test/msw/keycloak-admin.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { createOwnDatabase } from '../../../test/setup/own-database.js';
import { AuthenticationModule } from '../../platform/authentication/authentication.module.js';
import { ClockModule } from '../../platform/clock/clock.module.js';
import { ConfigModule } from '../../platform/config/config.module.js';
import type { TrybunConfig } from '../../platform/config/config.schema.js';
import { DatabaseModule } from '../../platform/database/database.module.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { ErrorsModule } from '../../platform/errors/errors.module.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';
import { HttpModule } from '../../platform/http/http.module.js';
import { KeycloakAdminModule } from '../../platform/keycloak-admin/keycloak-admin.module.js';
import { LoggingModule } from '../../platform/logging/logging.module.js';
import { SetupModule } from './setup.module.js';
import { SetupService } from './setup.service.js';
import { type CommandOutput, runSetupTokenCommand } from './setup-token.command.js';

describe('first-run wizard', () => {
  let config: TrybunConfig;
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let setup: SetupService;
  let keycloak: KeycloakAdminFake;

  const administrator = {
    firstName: 'Ada',
    lastName: 'Admin',
    email: 'Ada@Example.com',
    password: 'correct horse battery staple',
    language: 'pl',
    timeZone: 'Europe/Warsaw',
  };

  /** A new setup link's token, as the `setup-token` command issues it. */
  async function issueToken(): Promise<string> {
    const { link } = await setup.issueToken();
    return new URL(link).hash.replace('#token=', '');
  }

  function createAdministrator(token: string, body: object = administrator) {
    return request(app.getHttpServer())
      .post('/api/v1/setup/administrator')
      .send({ ...body, token });
  }

  beforeAll(async () => {
    // The wizard depends on whether any Administrator exists, so it has a database of its own.
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
        KeycloakAdminModule,
        SetupModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
    prisma = app.get(PrismaService);
    setup = app.get(SetupService);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
    await prisma.setupToken.deleteMany();
    keycloak = keycloakAdminFake(config);
    mswServer.use(...keycloak.handlers);
  });

  afterAll(async () => {
    await app.close();
  });

  it('is available with the system defaults while no Administrator exists', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/setup');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'available',
      defaultLanguage: 'en',
      defaultTimeZone: 'UTC',
    });
  });

  it('verifies a valid token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/setup/token-verification')
      .send({ token: await issueToken() });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'available' });
  });

  it('stores only the hash of the token, valid for 24 hours', async () => {
    const before = Date.now();
    const token = await issueToken();

    const [stored] = await prisma.setupToken.findMany();
    expect(stored?.tokenHash).not.toContain(token);
    expect(stored?.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 24 * 3_600_000);
    expect(stored?.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 24 * 3_600_000);
  });

  it('creates the first Administrator with the password and the required OTP set-up', async () => {
    const res = await createAdministrator(await issueToken());

    expect(res.status).toBe(201);
    const [keycloakUserId, keycloakUser] = [...keycloak.created][0] ?? [];
    expect(keycloakUser).toMatchObject({
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Admin',
      groups: ['/team'],
      requiredActions: ['CONFIGURE_TOTP'],
      credentials: [{ type: 'password', value: administrator.password, temporary: false }],
    });
    expect(
      await prisma.user.findUniqueOrThrow({
        where: { id: (res.body as { id: string }).id },
        select: {
          keycloakUserId: true,
          email: true,
          displayName: true,
          language: true,
          timeZone: true,
          kind: true,
          isAdmin: true,
          state: true,
        },
      }),
    ).toEqual({
      keycloakUserId,
      email: 'ada@example.com',
      displayName: 'Ada Admin',
      language: 'pl',
      timeZone: 'Europe/Warsaw',
      kind: 'team',
      isAdmin: true,
      state: 'active',
    });
  });

  it.each([
    ['an unknown token', () => Promise.resolve('unknown-token')],
    [
      'an expired token',
      async () => {
        const token = await issueToken();
        await prisma.setupToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1_000) } });
        return token;
      },
    ],
    [
      'a replaced token',
      async () => {
        const token = await issueToken();
        await issueToken();
        return token;
      },
    ],
  ])('rejects %s with the same error', async (_case, tokenOf) => {
    const token = await tokenOf();

    const verification = await request(app.getHttpServer())
      .post('/api/v1/setup/token-verification')
      .send({ token });
    const creation = await createAdministrator(token);

    for (const res of [verification, creation]) {
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'setup.token_invalid' });
    }
    expect(keycloak.created.size).toBe(0);
  });

  it('rejects a used token and is disabled permanently after success', async () => {
    const token = await issueToken();
    await createAdministrator(token);

    const again = await createAdministrator(token, { ...administrator, email: 'eve@example.com' });
    const status = await request(app.getHttpServer()).get('/api/v1/setup');

    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ code: 'setup.completed' });
    expect(status.body).toMatchObject({ status: 'completed' });
    await expect(setup.issueToken()).rejects.toMatchObject({ code: 'setup.completed' });
  });

  it('creates one Administrator from two simultaneous requests', async () => {
    const token = await issueToken();

    const responses = await Promise.all([
      createAdministrator(token),
      createAdministrator(token, { ...administrator, email: 'eve@example.com' }),
    ]);

    // The second request loses the token (`404`), or – if it starts after the first one has
    // committed – finds the wizard completed (`409`).
    const [winner, loser] = responses.toSorted((a, b) => a.status - b.status);
    expect(winner?.status).toBe(201);
    expect([404, 409]).toContain(loser?.status);
    expect(await prisma.user.count({ where: { isAdmin: true } })).toBe(1);
    // A Keycloak user of the request that lost is deleted again.
    expect(keycloak.created.size).toBe(1);
  });

  it('rejects an e-mail address that has a Keycloak user on its field', async () => {
    keycloak.created.set('existing', { email: 'ada@example.com' });

    const res = await createAdministrator(await issueToken());

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'setup.email_taken',
      errors: [{ pointer: '/email', code: 'field.invalid' }],
    });
    expect(await prisma.setupToken.count({ where: { usedAt: null } })).toBe(1);
  });

  it('rejects an invalid body with 422', async () => {
    const res = await createAdministrator(await issueToken(), {
      ...administrator,
      timeZone: 'Nowhere/City',
    });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'request.validation_failed',
      errors: [expect.objectContaining({ pointer: '/timeZone' }) as unknown],
    });
  });

  describe('setup-token command', () => {
    function capture(): CommandOutput & { text: string[]; errors: string[] } {
      const text: string[] = [];
      const errors: string[] = [];
      return { text, errors, out: (t) => text.push(t), error: (t) => errors.push(t) };
    }

    it('prints a new setup link', async () => {
      const output = capture();

      const code = await runSetupTokenCommand(setup, config.domain, output);

      expect(code).toBe(0);
      expect(output.text.join('')).toMatch(
        /https:\/\/trybun\.example\.com\/setup#token=[\w-]{43}\n/,
      );
    });

    it('refuses once an Administrator exists', async () => {
      await createUser(prisma, { kind: 'team', isAdmin: true });
      const output = capture();

      const code = await runSetupTokenCommand(setup, config.domain, output);

      expect(code).toBe(1);
      expect(output.errors.join('')).toContain('already set up');
      expect(await prisma.setupToken.count()).toBe(0);
    });
  });
});
