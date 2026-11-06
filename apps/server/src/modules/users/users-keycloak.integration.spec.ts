// The Worker job of deactivation and reactivation (§7.4) against a real Keycloak with the realm
// configuration of the deployment package: the Keycloak user follows the state of its account.
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { Network, type StartedNetwork } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createUser } from '../../../test/factories/user.factory.js';
import { refreshAccessToken, signIn } from '../../../test/keycloak/browser-sign-in.js';
import {
  adminApi,
  applyRealmConfig,
  startKeycloak,
  type TestKeycloak,
} from '../../../test/keycloak/keycloak.js';
import { TEST_ENV } from '../../../test/env.js';
import { ConfigModule } from '../../platform/config/config.module.js';
import { loadConfig } from '../../platform/config/load-config.js';
import { DatabaseModule } from '../../platform/database/database.module.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { KeycloakAdminModule } from '../../platform/keycloak-admin/keycloak-admin.module.js';
import { LoggingModule } from '../../platform/logging/logging.module.js';
import { USER_DEACTIVATED, USER_REACTIVATED } from './users.events.js';
import { UsersKeycloakProcessor } from './users.processor.js';
import { UsersKeycloakService } from './users-keycloak.service.js';

interface KeycloakUser {
  enabled: boolean;
  email: string;
  firstName: string;
  lastName: string;
}

const PASSWORD = 'correct horse battery staple';

describe('the Keycloak job of deactivation and reactivation', () => {
  let network: StartedNetwork;
  let keycloak: TestKeycloak;
  let admin: Awaited<ReturnType<typeof adminApi>>;
  let prisma: PrismaService;
  let processor: UsersKeycloakProcessor;
  let close: () => Promise<void>;

  beforeAll(async () => {
    network = await new Network().start();
    keycloak = await startKeycloak(network);
    await applyRealmConfig(network);
    admin = await adminApi(keycloak);
    const config = loadConfig({
      ...TEST_ENV,
      DATABASE_URL: inject('databaseUrl'),
      TRYBUN_VALKEY_URL: inject('valkeyUrl'),
      TRYBUN_KEYCLOAK_URL: keycloak.url,
    });
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(config),
        LoggingModule.forRoot(),
        DatabaseModule,
        KeycloakAdminModule,
      ],
      providers: [UsersKeycloakService, UsersKeycloakProcessor],
    }).compile();
    const app = await moduleRef.init();
    prisma = app.get(PrismaService);
    processor = app.get(UsersKeycloakProcessor);
    close = () => app.close();
  }, 300_000);

  afterAll(async () => {
    await close();
    await keycloak.container.stop();
    await network.stop();
  });

  /** An end user with a password and a signed-in Keycloak session, linked to an account. */
  async function signedInAccount() {
    const email = `${randomUUID()}@example.com`;
    await admin('POST', '/users', {
      username: email,
      email,
      emailVerified: true,
      enabled: true,
      firstName: 'Ewa',
      lastName: 'Nowak',
      credentials: [{ type: 'password', value: PASSWORD, temporary: false }],
    });
    const [{ id } = { id: '' }] = await admin<{ id: string }[]>(
      'GET',
      `/users?email=${encodeURIComponent(email)}&exact=true`,
    );
    const session = await signIn(keycloak, { username: email, password: PASSWORD });
    const user = await createUser(prisma, { email, keycloakUserId: id });
    return { user, email, keycloakUserId: id, refreshToken: session.refreshToken ?? '' };
  }

  function runJob(type: string, userId: string) {
    return processor.process({
      id: randomUUID(),
      name: type,
      data: { payload: { userId }, requestId: null },
    } as Job);
  }

  it('disables a deactivated account and ends its sessions, idempotently', async () => {
    const { user, email, keycloakUserId, refreshToken } = await signedInAccount();
    expect(await admin<unknown[]>('GET', `/users/${keycloakUserId}/sessions`)).toHaveLength(1);
    await prisma.user.update({ where: { id: user.id }, data: { state: 'deactivated' } });

    await runJob(USER_DEACTIVATED, user.id);
    await runJob(USER_DEACTIVATED, user.id);

    expect(await admin<KeycloakUser>('GET', `/users/${keycloakUserId}`)).toMatchObject({
      enabled: false,
      email,
      firstName: 'Ewa',
      lastName: 'Nowak',
    });
    expect(await admin<unknown[]>('GET', `/users/${keycloakUserId}/sessions`)).toEqual([]);
    expect(await refreshAccessToken(keycloak, refreshToken)).toBeUndefined();
    expect((await signIn(keycloak, { username: email, password: PASSWORD })).accessToken).toBe(
      undefined,
    );
  });

  it('enables a reactivated account, so it signs in again', async () => {
    const { user, email, keycloakUserId } = await signedInAccount();
    await prisma.user.update({ where: { id: user.id }, data: { state: 'deactivated' } });
    await runJob(USER_DEACTIVATED, user.id);
    await prisma.user.update({ where: { id: user.id }, data: { state: 'active' } });

    await runJob(USER_REACTIVATED, user.id);

    expect(await admin<KeycloakUser>('GET', `/users/${keycloakUserId}`)).toMatchObject({
      enabled: true,
    });
    expect(
      (await signIn(keycloak, { username: email, password: PASSWORD })).accessToken,
    ).toBeDefined();
  });

  it('applies the current state, so an older event never undoes a newer change', async () => {
    const { user, keycloakUserId } = await signedInAccount();

    // The account was deactivated and reactivated before the job of the deactivation ran.
    await runJob(USER_DEACTIVATED, user.id);

    expect(await admin<KeycloakUser>('GET', `/users/${keycloakUserId}`)).toMatchObject({
      enabled: true,
    });
  });

  it('completes for an account whose Keycloak user no longer exists or that has none', async () => {
    const { user, keycloakUserId } = await signedInAccount();
    await admin('DELETE', `/users/${keycloakUserId}`);
    await prisma.user.update({ where: { id: user.id }, data: { state: 'deactivated' } });
    const invited = await createUser(prisma, { state: 'deactivated' });

    await expect(runJob(USER_DEACTIVATED, user.id)).resolves.toBeUndefined();
    await expect(runJob(USER_DEACTIVATED, invited.id)).resolves.toBeUndefined();
  });

  it('rejects job data without an account', async () => {
    await expect(
      processor.process({ id: randomUUID(), data: { payload: {} } } as Job),
    ).rejects.toThrow();
  });
});
