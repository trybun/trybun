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
    // With GitHub sign-in, whose links the adapter reads.
    await applyRealmConfig(network, {
      TRYBUN_GITHUB_CLIENT_ID: 'github-client',
      TRYBUN_GITHUB_CLIENT_SECRET: 'github-secret',
    });
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

  it.each([
    ['too short', 'fourteen chars'],
    ['on the blocklist', 'correcthorsebatterystaple'],
  ])('rejects a password %s at its field and creates no user', async (_case, password) => {
    const administrator = newAdministrator({ password });

    await expect(client.createAdministrator(administrator)).rejects.toEqual(
      new AppError('setup.password_rejected', [{ pointer: '/password', code: 'field.invalid' }]),
    );
    expect(await admin('GET', `/users?email=${encodeURIComponent(administrator.email)}`)).toEqual(
      [],
    );
  });

  it('deletes a user and ignores one that no longer exists', async () => {
    const id = await client.createAdministrator(newAdministrator());

    await client.deleteUser(id);
    await client.deleteUser(id);

    await expect(admin('GET', `/users/${id}`)).rejects.toThrow(/404/);
  });

  it('creates an end user without the group team or required actions', async () => {
    const endUser = newAdministrator();
    const id = await client.createEndUser(endUser);

    expect(await admin<KeycloakUser>('GET', `/users/${id}`)).toMatchObject({
      email: endUser.email,
      emailVerified: true,
      requiredActions: [],
      attributes: { locale: ['pl'] },
    });
    expect(await admin('GET', `/users/${id}/groups`)).toEqual([]);
    const result = await signIn(keycloak, { username: endUser.email, password: endUser.password });
    expect(result.accessToken).toBeDefined();
  });

  it('answers an end user with a taken address or a refused password with the invitation codes', async () => {
    const endUser = newAdministrator();
    await client.createEndUser(endUser);

    await expect(client.createEndUser(endUser)).rejects.toMatchObject({
      code: 'invitation.email_taken',
    });
    await expect(
      client.createEndUser(newAdministrator({ password: 'fourteen chars' })),
    ).rejects.toEqual(
      new AppError('invitation.password_rejected', [
        { pointer: '/password', code: 'field.invalid' },
      ]),
    );
  });

  it('reads the names of a user, and none of a user that does not exist', async () => {
    const id = await client.createEndUser(newAdministrator());

    expect(await client.findUserProfile(id)).toEqual({ firstName: 'Ada', lastName: 'Admin' });
    expect(await client.findUserProfile(randomUUID())).toBeNull();
  });

  it('sets a verified address, refusing one that another user has', async () => {
    const id = await client.createEndUser(newAdministrator());
    const other = newAdministrator();
    await client.createEndUser(other);
    const email = `${randomUUID()}@example.com`;

    await client.setVerifiedEmail(id, email);

    expect(await admin<KeycloakUser>('GET', `/users/${id}`)).toMatchObject({
      email,
      emailVerified: true,
    });
    await expect(client.setVerifiedEmail(id, other.email)).rejects.toEqual(
      new AppError('invitation.email_taken'),
    );
  });

  it('reads the GitHub login of a linked GitHub account', async () => {
    const id = await client.createEndUser(newAdministrator());
    expect(await client.findGithubLogin(id)).toBeNull();
    await admin('POST', `/users/${id}/federated-identity/github`, {
      identityProvider: 'github',
      userId: '583231',
      userName: 'octocat',
    });

    expect(await client.findGithubLogin(id)).toBe('octocat');
  });

  it('adds a user to the group team, repeatably', async () => {
    const id = await client.createEndUser(newAdministrator());

    await client.addToTeamGroup(id);
    await client.addToTeamGroup(id);

    expect(await admin<{ path: string }[]>('GET', `/users/${id}/groups`)).toEqual([
      expect.objectContaining({ path: '/team' }),
    ]);
  });

  it('lists every user with its creation time, without service accounts', async () => {
    const before = Date.now() - 1_000;
    const id = await client.createEndUser(newAdministrator());

    const users = await client.listUsers();

    expect(users.find((user) => user.id === id)?.createdAt.getTime()).toBeGreaterThan(before);
    const serviceAccount = await admin<{ id: string }>(
      'GET',
      `/clients/${(await admin<{ id: string }[]>('GET', '/clients?clientId=trybun-server'))[0]?.id}/service-account-user`,
    );
    expect(users.map((user) => user.id)).not.toContain(serviceAccount.id);
  });
});
