import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { GettingStartedPage } from '@trybun/contracts/administration';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import packageJson from '../../../package.json' with { type: 'json' };
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createOrganization } from '../../../test/factories/organization.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { createOwnDatabase } from '../../../test/setup/own-database.js';
import { AuthenticationModule } from '../../platform/authentication/authentication.module.js';
import { AuthorizationModule } from '../../platform/authorization/authorization.module.js';
import { ConfigModule } from '../../platform/config/config.module.js';
import type { TrybunConfig } from '../../platform/config/config.schema.js';
import { DatabaseModule } from '../../platform/database/database.module.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { ErrorsModule } from '../../platform/errors/errors.module.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';
import { HttpModule } from '../../platform/http/http.module.js';
import { LoggingModule } from '../../platform/logging/logging.module.js';
import { administrationAbilities } from './administration.abilities.js';
import { AdministrationModule } from './administration.module.js';

describe('administration endpoints', () => {
  let config: TrybunConfig;
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  // The checklist reads the whole system (e.g. whether any project exists), so this file has a
  // database of its own: the other test files create projects in parallel.
  let databaseUrl: string;

  beforeAll(async () => {
    databaseUrl = await createOwnDatabase();
  });

  async function start(overrides: Partial<TrybunConfig> = {}): Promise<void> {
    config = { ...integrationConfig(), databaseUrl, ...overrides };
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(config),
        LoggingModule.forRoot(),
        DatabaseModule,
        ErrorsModule,
        HttpModule,
        AuthenticationModule,
        AuthorizationModule.forRoot({ rules: [administrationAbilities], restrictions: [] }),
        AdministrationModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
    prisma = app.get(PrismaService);
    mswServer.use(keycloakJwksHandler(config));
  }

  /** A signed-in team member with completed 2FA. */
  async function signIn(isAdmin: boolean): Promise<string> {
    const user = await createUser(prisma, { kind: 'team', isAdmin, keycloakUserId: randomUUID() });
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: ['pwd', 'otp'],
    });
    return `Bearer ${token}`;
  }

  function get(path: string, authorization?: string) {
    const req = request(app.getHttpServer()).get(`/api/v1/administration/${path}`);
    return authorization === undefined ? req : req.set('Authorization', authorization);
  }

  afterEach(async () => {
    await app.close();
  });

  describe('with no optional setting', () => {
    beforeEach(() =>
      start({
        isGithubSignInConfigured: false,
        isSmtpConfigured: false,
        isBackupStorageConfigured: false,
      }),
    );

    it('shows the checklist to an Administrator with nothing done', async () => {
      const res = await get('getting-started', await signIn(true));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        items: [
          { id: 'create_project', isDone: false, isOptional: false },
          { id: 'configure_github_sign_in', isDone: false, isOptional: false },
          { id: 'invite_team', isDone: false, isOptional: false },
          { id: 'create_organization', isDone: false, isOptional: true },
          { id: 'configure_email', isDone: false, isOptional: false },
          { id: 'configure_backup_storage', isDone: false, isOptional: false },
        ],
        nextCursor: null,
      });
    });

    it('shows the version of /health and the license', async () => {
      const res = await get('about', await signIn(true));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ version: packageJson.version, license: 'MIT' });
    });

    it.each(['getting-started', 'about'])(
      'answers 404 to a team member who is not an Administrator: %s',
      async (path) => {
        const res = await get(path, await signIn(false));

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ code: 'request.not_found' });
      },
    );

    it('requires a signed-in account', async () => {
      const res = await get('getting-started');

      expect(res.status).toBe(401);
    });
  });

  it('ticks the items once their settings are configured', async () => {
    await start({
      isGithubSignInConfigured: true,
      isSmtpConfigured: true,
      isBackupStorageConfigured: true,
    });
    await createProject(prisma, { state: 'archived' });
    await createOrganization(prisma, { state: 'archived' });
    await createUser(prisma, { kind: 'team', state: 'invited' });

    const res = await get('getting-started', await signIn(true));

    expect(res.body).toMatchObject({
      items: [
        { id: 'create_project', isDone: true },
        { id: 'configure_github_sign_in', isDone: true },
        { id: 'invite_team', isDone: true },
        { id: 'create_organization', isDone: true },
        { id: 'configure_email', isDone: true },
        { id: 'configure_backup_storage', isDone: true },
      ],
    });
  });

  it('ticks "Invite the team" once a team account other than the first Administrator is invited or active', async () => {
    // A fresh database: the first Administrator is the oldest team account (§15.6).
    await start({ databaseUrl: await createOwnDatabase() });
    const authorization = await signIn(true);
    const inviteTeam = async () => {
      const res = await get('getting-started', authorization);
      return (res.body as GettingStartedPage).items.find((item) => item.id === 'invite_team');
    };
    await createUser(prisma, { kind: 'team', state: 'deactivated' });
    await createUser(prisma, { kind: 'end_user', state: 'active' });
    await createUser(prisma, { kind: 'end_user', state: 'invited' });

    expect(await inviteTeam()).toMatchObject({ isDone: false });

    await createUser(prisma, { kind: 'team', state: 'invited' });

    expect(await inviteTeam()).toMatchObject({ isDone: true });
  });
});
