// The adapter of the Keycloak Admin API against a real Keycloak with the realm configuration of
// the deployment package (§15.5, §15.6).
import { randomUUID } from 'node:crypto';
import { Network, type StartedNetwork } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signIn } from '../../../test/keycloak/browser-sign-in.js';
import {
  adminApi,
  applyRealmConfig,
  startKeycloak,
  type TestKeycloak,
} from '../../../test/keycloak/keycloak.js';
import { TEST_ENV } from '../../../test/env.js';
import { loadConfig } from '../config/load-config.js';
import { AppError } from '../errors/app-error.js';
import type { NewAdministrator } from './keycloak-admin.js';
import { KeycloakAdminClient } from './keycloak-admin-client.js';

interface KeycloakUser {
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  requiredActions: string[];
  attributes?: Record<string, string[]>;
}

describe('KeycloakAdminClient', () => {
  let network: StartedNetwork;
  let keycloak: TestKeycloak;
  let admin: Awaited<ReturnType<typeof adminApi>>;
  let client: KeycloakAdminClient;

  function newAdministrator(overrides: Partial<NewAdministrator> = {}): NewAdministrator {
    return {
      email: `${randomUUID()}@example.com`,
      firstName: 'Ada',
      lastName: 'Admin',
      password: 'correct horse battery staple',
      language: 'pl',
      ...overrides,
    };
  }

  beforeAll(async () => {
    network = await new Network().start();
    keycloak = await startKeycloak(network);
    await applyRealmConfig(network);
    admin = await adminApi(keycloak);
    client = new KeycloakAdminClient(
      loadConfig({ ...TEST_ENV, TRYBUN_KEYCLOAK_URL: keycloak.url }),
    );
  }, 300_000);

  afterAll(async () => {
    await keycloak.container.stop();
    await network.stop();
  });

  it('creates a team member who must set up OTP at the first sign-in', async () => {
    const administrator = newAdministrator();

    const id = await client.createAdministrator(administrator);

    expect(await admin<KeycloakUser>('GET', `/users/${id}`)).toMatchObject({
      email: administrator.email,
      firstName: 'Ada',
      lastName: 'Admin',
      emailVerified: true,
      requiredActions: ['CONFIGURE_TOTP'],
      attributes: { locale: ['pl'] },
    });
    expect(await admin<{ path: string }[]>('GET', `/users/${id}/groups`)).toEqual([
      expect.objectContaining({ path: '/team' }),
    ]);
    const result = await signIn(keycloak, {
      username: administrator.email,
      password: administrator.password,
    });
    expect(result.stoppedAt).toContain('execution=CONFIGURE_TOTP');
  });

  it('rejects an e-mail address that has a Keycloak user', async () => {
    const administrator = newAdministrator();
    await client.createAdministrator(administrator);

    await expect(client.createAdministrator(administrator)).rejects.toEqual(
      new AppError('setup.email_taken', [{ pointer: '/email', code: 'field.invalid' }]),
    );
  });

  it('rejects a password the password policy refuses and creates no user', async () => {
    await admin('PUT', '', { passwordPolicy: 'length(12)' });
    const administrator = newAdministrator({ password: 'short' });

    try {
      await expect(client.createAdministrator(administrator)).rejects.toEqual(
        new AppError('setup.password_rejected', [{ pointer: '/password', code: 'field.invalid' }]),
      );
      expect(await admin('GET', `/users?email=${encodeURIComponent(administrator.email)}`)).toEqual(
        [],
      );
    } finally {
      await admin('PUT', '', { passwordPolicy: '' });
    }
  });

  it('deletes a user and ignores one that no longer exists', async () => {
    const id = await client.createAdministrator(newAdministrator());

    await client.deleteUser(id);
    await client.deleteUser(id);

    await expect(admin('GET', `/users/${id}`)).rejects.toThrow(/404/);
  });
});
