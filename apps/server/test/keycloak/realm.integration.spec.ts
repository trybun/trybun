// The realm configuration of the deployment package (docker/keycloak) applied by
// keycloak-config-cli to a real Keycloak (§7.4, §14.4, §15.5).
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Network, type StartedNetwork } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/platform/config/load-config.js';
import { KeycloakAccessTokenVerifier } from '../../src/platform/authentication/keycloak-access-token-verifier.js';
import { TEST_ENV } from '../env.js';
import { refreshAccessToken, signIn, signInToRequiredAction } from './browser-sign-in.js';
import {
  adminApi,
  applyRealmConfig,
  startKeycloak,
  type TestKeycloak,
  WEB_URL,
} from './keycloak.js';

interface Realm {
  defaultLocale?: string;
  passwordPolicy?: string;
  failureFactor?: number;
  displayNameHtml?: string;
  bruteForceProtected?: boolean;
  registrationAllowed?: boolean;
}

const OTP_SECRET = 'integration-test-otp';
/** A password that meets the password policy of the realm (§7.4). */
const PASSWORD = 'a passphrase for the tests';

describe('Keycloak realm configuration', () => {
  let network: StartedNetwork;
  let keycloak: TestKeycloak;
  let admin: Awaited<ReturnType<typeof adminApi>>;

  async function createUser(options: { team: boolean; otp: boolean }): Promise<string> {
    const username = `${randomUUID()}@example.com`;
    await admin('POST', '/users', {
      username,
      email: username,
      firstName: 'Test',
      lastName: 'User',
      emailVerified: true,
      enabled: true,
      groups: options.team ? ['/team'] : [],
      credentials: [
        { type: 'password', value: PASSWORD, temporary: false },
        ...(options.otp
          ? [
              {
                type: 'otp',
                secretData: JSON.stringify({ value: OTP_SECRET }),
                credentialData: JSON.stringify({
                  subType: 'totp',
                  digits: 6,
                  counter: 0,
                  period: 30,
                  algorithm: 'HmacSHA1',
                }),
              },
            ]
          : []),
      ],
    });
    return username;
  }

  beforeAll(async () => {
    network = await new Network().start();
    keycloak = await startKeycloak(network);
    await applyRealmConfig(network);
    admin = await adminApi(keycloak);
  }, 300_000);

  afterAll(async () => {
    await keycloak.container.stop();
    await network.stop();
  });

  it('applies the managed settings', async () => {
    const realm = await admin<Realm>('GET', '');

    expect(realm).toMatchObject({
      bruteForceProtected: true,
      failureFactor: 5,
      registrationAllowed: false,
    });
  });

  describe('password policy', () => {
    async function userWithTemporaryPassword(): Promise<{ id: string; username: string }> {
      const username = `${randomUUID()}@example.com`;
      await admin('POST', '/users', {
        username,
        email: username,
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
        enabled: true,
        credentials: [{ type: 'password', value: PASSWORD, temporary: true }],
      });
      const [user] = await admin<{ id: string }[]>(
        'GET',
        `/users?exact=true&username=${encodeURIComponent(username)}`,
      );
      return { id: user?.id ?? '', username };
    }

    it('applies the policy with Argon2', async () => {
      expect((await admin<Realm>('GET', '')).passwordPolicy).toBe(
        'length(15) and maxLength(64) and notEmail and notUsername and passwordBlacklist(trybun.txt) and hashAlgorithm(argon2)',
      );
    });

    it.each([
      ['14 characters', 'fourteen chars', /minimum length/i],
      ['a password of the blocklist', 'correcthorsebatterystaple', /blacklist/i],
    ])('refuses %s on reset', async (_case, password, message) => {
      const { id } = await userWithTemporaryPassword();

      await expect(
        admin('PUT', `/users/${id}/reset-password`, { type: 'password', value: password }),
      ).rejects.toThrow(message);
      await admin('PUT', `/users/${id}/reset-password`, {
        type: 'password',
        value: 'fifteen chars!!',
        temporary: false,
      });
    });

    it.each([
      ['en', 'The password must have at least 15 characters.'],
      ['pl', 'Hasło musi mieć co najmniej 15 znaków.'],
    ])('explains a refused password on the Keycloak screen (%s)', async (locale, message) => {
      const { username } = await userWithTemporaryPassword();
      const page = await signInToRequiredAction(keycloak, { username, password: PASSWORD, locale });
      expect(page.html).toContain('password-new');

      const html = await page.submit({
        'password-new': 'fourteen chars',
        'password-confirm': 'fourteen chars',
      });

      expect(html).toContain(message);
    });
  });

  it('re-running applies a changed setting and keeps changes outside the managed settings', async () => {
    await admin('PUT', '', { displayNameHtml: '<b>ACME</b>', failureFactor: 30 });
    await admin('POST', '/clients', { clientId: 'created-by-an-administrator', enabled: true });

    await applyRealmConfig(network, { TRYBUN_DEFAULT_LANGUAGE: 'pl' });

    const realm = await admin<Realm>('GET', '');
    const clients = await admin<{ clientId: string }[]>('GET', '/clients');
    expect(realm).toMatchObject({
      defaultLocale: 'pl',
      // A managed setting changed in Keycloak is restored.
      failureFactor: 5,
      displayNameHtml: '<b>ACME</b>',
    });
    expect(clients.map((client) => client.clientId)).toContain('created-by-an-administrator');
  }, 120_000);

  it('creates a sign-in provider only when its variables are set', async () => {
    const before = await admin<{ alias: string }[]>('GET', '/identity-provider/instances');

    await applyRealmConfig(network, {
      TRYBUN_GITHUB_CLIENT_ID: 'github-client',
      TRYBUN_GITHUB_CLIENT_SECRET: 'github-secret',
    });

    const after = await admin<{ alias: string }[]>('GET', '/identity-provider/instances');
    expect(before.map((provider) => provider.alias)).not.toContain('github');
    expect(after.map((provider) => provider.alias)).toContain('github');
  }, 120_000);

  describe('login screen', () => {
    /** The login page of the sign-in of the web application. */
    async function loginPage(
      params: Record<string, string>,
      headers: Record<string, string>,
    ): Promise<string> {
      const authorize = new URL(`${keycloak.url}/realms/trybun/protocol/openid-connect/auth`);
      authorize.search = new URLSearchParams({
        client_id: 'trybun-web',
        redirect_uri: `${WEB_URL}/api/auth/callback/keycloak`,
        response_type: 'code',
        scope: 'openid',
        code_challenge: createHash('sha256').update(randomBytes(32)).digest('base64url'),
        code_challenge_method: 'S256',
        ...params,
      }).toString();
      const response = await fetch(authorize, { headers });
      return response.text();
    }

    it.each([
      // The language of the web application wins over the browser language.
      [
        { ui_locales: 'pl' },
        { 'accept-language': 'en-US,en;q=0.9' },
        'pl',
        'Zaloguj się do systemu Trybun',
      ],
      [{ ui_locales: 'en' }, { 'accept-language': 'pl-PL,pl;q=0.9' }, 'en', 'Sign in to Trybun'],
      // Without it, the browser language.
      [{}, { 'accept-language': 'pl-PL,pl;q=0.9' }, 'pl', 'Zaloguj się do systemu Trybun'],
    ])(
      'with %j and %j appears in %s with the texts of @trybun/i18n',
      async (params, headers, lang, title) => {
        const html = await loginPage(params, headers);

        expect(html).toContain(`lang="${lang}"`);
        expect(html).toContain(title);
      },
    );
  });

  it('does not let a team member without 2FA complete the sign-in', async () => {
    const username = await createUser({ team: true, otp: false });

    const result = await signIn(keycloak, { username, password: PASSWORD });

    expect(result.accessToken).toBeUndefined();
    expect(result.stoppedAt).toMatch(/\/login-actions\/required-action\?.*CONFIGURE_TOTP/);
  });

  describe('access tokens accepted by the API', () => {
    function verifier(): KeycloakAccessTokenVerifier {
      return new KeycloakAccessTokenVerifier(
        loadConfig({
          ...TEST_ENV,
          TRYBUN_KEYCLOAK_URL: keycloak.url,
          TRYBUN_KEYCLOAK_PUBLIC_URL: keycloak.url,
        }),
      );
    }

    it('signs a team member in with a password and a one-time password', async () => {
      const username = await createUser({ team: true, otp: true });

      const { accessToken } = await signIn(keycloak, {
        username,
        password: PASSWORD,
        otpSecret: OTP_SECRET,
      });

      const claims = await verifier().verify(accessToken ?? '');
      expect(claims?.amr).toEqual(['pwd', 'otp']);
    });

    it('keeps the second factor in the tokens of a later refresh', async () => {
      const username = await createUser({ team: true, otp: true });
      const { refreshToken } = await signIn(keycloak, {
        username,
        password: PASSWORD,
        otpSecret: OTP_SECRET,
      });
      await new Promise((resolve) => setTimeout(resolve, 2_000));

      const accessToken = await refreshAccessToken(keycloak, refreshToken ?? '');

      const claims = await verifier().verify(accessToken);
      expect(claims?.amr).toEqual(['pwd', 'otp']);
    });

    it('signs an end user in with a password only', async () => {
      const username = await createUser({ team: false, otp: false });

      const { accessToken } = await signIn(keycloak, { username, password: PASSWORD });

      const claims = await verifier().verify(accessToken ?? '');
      expect(claims?.amr).toEqual(['pwd']);
    });

    it('rejects a token of Keycloak issued for another audience', async () => {
      const response = await fetch(`${keycloak.url}/realms/master/protocol/openid-connect/token`, {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: 'admin-cli',
          username: 'admin',
          password: 'admin',
        }),
      });
      const { access_token: token } = (await response.json()) as { access_token: string };

      await expect(verifier().verify(token)).resolves.toBeUndefined();
    });
  });
});
