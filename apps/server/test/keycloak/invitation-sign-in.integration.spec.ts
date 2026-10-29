// The sign-ins of the invitation flow on a real Keycloak with the realm configuration of the
// deployment package (ADR 0009, "To confirm in S1-03"). A second realm of the same Keycloak stands
// in for GitHub, Microsoft or Google: an OpenID Connect provider with the flows of the providers.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { Network, type StartedNetwork } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KeycloakAccessTokenVerifier } from '../../src/platform/authentication/keycloak-access-token-verifier.js';
import { loadConfig } from '../../src/platform/config/load-config.js';
import { KeycloakAdminClient } from '../../src/platform/keycloak-admin/keycloak-admin-client.js';
import { TEST_ENV } from '../env.js';
import { totp } from './browser-sign-in.js';
import { type Browser, browser, type Page } from './browser.js';
import {
  adminApi,
  applyRealmConfig,
  startKeycloak,
  type TestKeycloak,
  WEB_CLIENT_SECRET,
  WEB_URL,
} from './keycloak.js';

const PROVIDER = 'upstream';
const PROVIDER_CLIENT_SECRET = 'upstream-client-secret';
const REDIRECT_URI = `${WEB_URL}/api/auth/callback/keycloak`;
/** A password that meets the password policy of the realm (§7.4). */
const PASSWORD = 'a passphrase for the tests';

interface KeycloakUser {
  id: string;
  email?: string;
}

describe('sign-ins of the invitation flow', () => {
  let network: StartedNetwork;
  let keycloak: TestKeycloak;
  let admin: Awaited<ReturnType<typeof adminApi>>;
  let provider: Awaited<ReturnType<typeof adminApi>>;

  /** A person of the provider; its address differs from any invitation address. */
  async function providerUser(): Promise<{ username: string; email: string }> {
    const username = `person-${randomUUID().slice(0, 8)}`;
    const email = `${username}@provider.example`;
    await provider('POST', '/users', {
      username,
      email,
      emailVerified: true,
      enabled: true,
      firstName: 'Pat',
      lastName: 'Provider',
      credentials: [{ type: 'password', value: PASSWORD, temporary: false }],
    });
    return { username, email };
  }

  /**
   * A sign-in of the web application through the provider, as `signIn(…, { scope })` of Auth.js
   * starts it from the acceptance page: Keycloak redirects to the provider (`kc_idp_hint`), the
   * person signs in there, and Keycloak runs its broker flows.
   */
  async function signInWithProvider(
    person: { username: string },
    scope: string,
  ): Promise<{
    page: Page;
    session: Browser;
    tokens: (last?: Page) => Promise<{ access_token: string }>;
  }> {
    const verifier = randomBytes(32).toString('base64url');
    const authorize = new URL(`${keycloak.url}/realms/trybun/protocol/openid-connect/auth`);
    authorize.search = new URLSearchParams({
      client_id: 'trybun-web',
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope,
      kc_idp_hint: PROVIDER,
      state: randomBytes(8).toString('hex'),
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    const session = browser();
    const login = await session.open(authorize.href);
    const page = await session.open(login.formAction, {
      username: person.username,
      password: PASSWORD,
    });
    return {
      page,
      session,
      tokens: async (last = page) => {
        const code = new URL(last.location ?? '').searchParams.get('code') ?? '';
        const response = await fetch(
          `${keycloak.url}/realms/trybun/protocol/openid-connect/token`,
          {
            method: 'POST',
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              redirect_uri: REDIRECT_URI,
              client_id: 'trybun-web',
              client_secret: WEB_CLIENT_SECRET,
              code_verifier: verifier,
            }),
          },
        );
        return (await response.json()) as { access_token: string };
      },
    };
  }

  function verifier(): KeycloakAccessTokenVerifier {
    return new KeycloakAccessTokenVerifier(
      loadConfig({
        ...TEST_ENV,
        TRYBUN_KEYCLOAK_URL: keycloak.url,
        TRYBUN_KEYCLOAK_PUBLIC_URL: keycloak.url,
      }),
    );
  }

  async function keycloakUsersWithEmail(email: string): Promise<KeycloakUser[]> {
    return admin<KeycloakUser[]>('GET', `/users?exact=true&email=${encodeURIComponent(email)}`);
  }

  beforeAll(async () => {
    network = await new Network().start();
    keycloak = await startKeycloak(network);
    await applyRealmConfig(network);
    admin = await adminApi(keycloak);
    await (
      await adminApi(keycloak, '')
    )('POST', '', { realm: PROVIDER, enabled: true });
    provider = await adminApi(keycloak, PROVIDER);
    await provider('POST', '/clients', {
      clientId: 'trybun-broker',
      secret: PROVIDER_CLIENT_SECRET,
      publicClient: false,
      standardFlowEnabled: true,
      redirectUris: ['*'],
    });
    // The browser reaches Keycloak through the mapped port, Keycloak itself on port 8080.
    await admin('POST', '/identity-provider/instances', {
      alias: PROVIDER,
      providerId: 'oidc',
      enabled: true,
      trustEmail: false,
      firstBrokerLoginFlowAlias: 'trybun first broker login',
      postBrokerLoginFlowAlias: 'trybun post broker login',
      config: {
        clientId: 'trybun-broker',
        clientSecret: PROVIDER_CLIENT_SECRET,
        clientAuthMethod: 'client_secret_post',
        authorizationUrl: `${keycloak.url}/realms/${PROVIDER}/protocol/openid-connect/auth`,
        tokenUrl: `http://localhost:8080/auth/realms/${PROVIDER}/protocol/openid-connect/token`,
        validateSignature: 'false',
        disableUserInfo: 'true',
        defaultScope: 'openid email profile',
        syncMode: 'IMPORT',
      },
    });
  }, 300_000);

  afterAll(async () => {
    await keycloak.container.stop();
    await network.stop();
  });

  it('creates no Keycloak user for a provider sign-in without an invitation', async () => {
    const person = await providerUser();

    const { page } = await signInWithProvider(person, 'openid');

    expect(page.location).toBeNull();
    expect(await keycloakUsersWithEmail(person.email)).toEqual([]);
  });

  it('creates the Keycloak user for a provider sign-in started from an invitation', async () => {
    const person = await providerUser();

    const { page, tokens } = await signInWithProvider(person, 'openid invitation');

    // An end user: the post broker login flow lets the sign-in complete without 2FA.
    expect(page.location).toMatch(new RegExp(`^${REDIRECT_URI}\\?.*code=`));
    const [user] = await keycloakUsersWithEmail(person.email);
    const claims = await verifier().verify((await tokens()).access_token);
    expect(claims?.sub).toBe(user?.id);
  });

  it('requires the 2FA set-up at the re-sign-in of a newly bound team member', async () => {
    const person = await providerUser();
    await (await signInWithProvider(person, 'openid invitation')).tokens();
    const [user] = await keycloakUsersWithEmail(person.email);
    // What the acceptance of a team invitation does through the Admin API (ADR 0009).
    const client = new KeycloakAdminClient(
      loadConfig({ ...TEST_ENV, TRYBUN_KEYCLOAK_URL: keycloak.url }),
    );
    const invitedEmail = `${randomUUID()}@invited.example`;
    await client.setVerifiedEmail(user?.id ?? '', invitedEmail);
    await client.addToTeamGroup(user?.id ?? '');

    const setUp = await signInWithProvider(person, 'openid');

    expect(setUp.page.location).toBeNull();
    const secret = setUp.page.field('totpSecret') ?? '';
    expect(secret).not.toBe('');
    const setUpDone = await setUp.session.open(setUp.page.formAction, {
      totp: totp(secret),
      totpSecret: secret,
      userLabel: 'Phone',
    });
    const setUpClaims = await verifier().verify((await setUp.tokens(setUpDone)).access_token);
    expect(setUpClaims?.sub).toBe(user?.id);
    // The sign-in that set the one-time password up has no `otp` in `amr`, so the API still
    // refuses team actions; the next sign-in asks for the one-time password.
    expect(setUpClaims?.amr).toEqual([]);
    // A code is accepted once per 30-second window.
    await setTimeout(30_000 - (Date.now() % 30_000) + 1_000);
    const next = await signInWithProvider(person, 'openid');
    const nextDone = await next.session.open(next.page.formAction, { otp: totp(secret) });
    const nextClaims = await verifier().verify((await next.tokens(nextDone)).access_token);
    expect(nextClaims?.amr).toEqual(['otp']);
    expect((await admin<KeycloakUser>('GET', `/users/${user?.id}`)).email).toBe(invitedEmail);
  }, 90_000);
});
