import type { Account } from 'next-auth';
import { SignJWT } from 'jose';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';
import { mswServer } from '../../../test/msw/server.js';
import type { SignInTokens } from './session-adapter.js';

vi.mock('server-only', () => ({}));

/** The cookies the response of the sign-in sets. */
const responseCookies = new Map<string, string>();
vi.mock('next/headers.js', () => ({
  cookies: () =>
    Promise.resolve({
      set: (name: string, value: string) => responseCookies.set(name, value),
      delete: (name: string) => responseCookies.delete(name),
    }),
}));

const { createAuthOptions, toKeycloakTokens } = await import('./auth-options.js');

const ID_TOKEN = await new SignJWT({ sub: 'user-1', sid: 'keycloak-session-1' })
  .setProtectedHeader({ alg: 'HS256' })
  .sign(new TextEncoder().encode('a test key of at least 32 characters'));

const ACCOUNT: Account = {
  provider: 'keycloak',
  type: 'oauth',
  providerAccountId: 'user-1',
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  id_token: ID_TOKEN,
  expires_at: 1_793_000_000,
};

describe('toKeycloakTokens', () => {
  it('takes the tokens, their expiry and the Keycloak session of a sign-in', () => {
    expect(toKeycloakTokens(ACCOUNT)).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: new Date(1_793_000_000_000),
      keycloakSessionId: 'keycloak-session-1',
    });
  });

  it.each(['access_token', 'refresh_token', 'expires_at', 'id_token'] as const)(
    'refuses a token response without %s',
    (field) => {
      expect(toKeycloakTokens({ ...ACCOUNT, [field]: undefined })).toBeUndefined();
    },
  );
});

describe('createAuthOptions', () => {
  beforeAll(() => {
    for (const [name, value] of Object.entries(TEST_ENV)) {
      vi.stubEnv(name, value);
    }
    mswServer.listen({ onUnhandledFrame: 'error' });
  });

  afterEach(() => {
    mswServer.resetHandlers();
    responseCookies.clear();
  });

  afterAll(() => {
    mswServer.close();
    vi.unstubAllEnvs();
  });

  /** The account of the API for the access token of the sign-in. */
  function currentUser(response: HttpResponse<object>) {
    mswServer.use(
      http.get(`${TEST_ENV.TRYBUN_API_URL}/api/v1/users/me`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer access-token'
          ? response
          : new HttpResponse(null, { status: 401 }),
      ),
    );
  }

  function signInCallback(signIn: SignInTokens | undefined, account: Account | null) {
    const callback = createAuthOptions(signIn).callbacks?.signIn;
    return callback?.({ user: { id: 'user-1' }, account });
  }

  it('keeps the tokens and the account kind of a sign-in for the session it creates', async () => {
    currentUser(
      HttpResponse.json({
        id: '0190f2f4-7c1e-7000-8000-000000000001',
        displayName: 'Ada Admin',
        email: 'ada@example.com',
        kind: 'end_user',
        language: null,
        timeZone: null,
        allowedActions: [],
      }),
    );
    const signIn: SignInTokens = {};

    expect(await signInCallback(signIn, ACCOUNT)).toBe(true);
    expect(signIn.current?.refreshToken).toBe('refresh-token');
    expect(signIn.accountKind).toBe('end_user');
    // Without a language of the account, the language of this device stays; without a time zone,
    // the system default applies.
    expect(responseCookies.size).toBe(0);
  });

  it('sets the language cookie from the language of the account', async () => {
    currentUser(
      HttpResponse.json({
        id: '0190f2f4-7c1e-7000-8000-000000000001',
        displayName: 'Ada Admin',
        email: 'ada@example.com',
        kind: 'team',
        language: 'pl',
        timeZone: 'Europe/Warsaw',
        allowedActions: [],
      }),
    );

    expect(await signInCallback({}, ACCOUNT)).toBe(true);
    expect(responseCookies.get('NEXT_LOCALE')).toBe('pl');
    expect(responseCookies.get('TRYBUN_TIME_ZONE')).toBe('Europe/Warsaw');
  });

  it('leaves the account kind unknown when the API refuses the account', async () => {
    currentUser(new HttpResponse(null, { status: 401 }));
    const signIn: SignInTokens = {};

    expect(await signInCallback(signIn, ACCOUNT)).toBe(true);
    expect(signIn.accountKind).toBeUndefined();
    expect(responseCookies.size).toBe(0);
  });

  it.each([
    ['without a sign-in slot (reading a session)', undefined, ACCOUNT],
    ['without an account', {}, null],
    ['with an incomplete token response', {}, { ...ACCOUNT, refresh_token: undefined }],
  ])('refuses a sign-in %s', async (_case, signIn, account) => {
    expect(await signInCallback(signIn, account)).toBe(false);
  });

  it('sends the browser a session without tokens or user data', async () => {
    const callback = createAuthOptions().callbacks?.session;

    const session = await callback?.({
      session: { expires: '2026-11-03T09:15:00.000Z', user: { email: 'ada@example.com' } },
      user: { id: 'user-1', email: '', emailVerified: null },
      token: {},
      newSession: undefined,
      trigger: 'update',
    });

    expect(session).toEqual({ expires: '2026-11-03T09:15:00.000Z' });
  });

  it('keeps the sessions on the server', () => {
    expect(createAuthOptions().session).toMatchObject({ strategy: 'database' });
  });
});
