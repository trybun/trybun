import { randomUUID } from 'node:crypto';
import { http, HttpResponse } from 'msw';
import type { Adapter } from 'next-auth/adapters';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYCLOAK_ENDPOINTS } from '../../../test/factories/keycloak-tokens.js';
import { mswServer } from '../../../test/msw/server.js';
import { stubIntegrationEnv } from '../../../test/setup/environment.js';
import type { SignInTokens } from './session-adapter.js';

vi.mock('server-only', () => ({}));
stubIntegrationEnv();

const { getPrisma } = await import('../database/prisma.js');
const { getEnv } = await import('../env/env.js');
const { createKeycloakClient } = await import('./keycloak-client.js');
const { createSessionAdapter, hashSessionToken } = await import('./session-adapter.js');
const { createTokenCipher } = await import('./token-cipher.js');

/** The adapter with the methods that `createSessionAdapter` implements. */
type SessionAdapter = { [K in keyof Adapter]-?: NonNullable<Adapter[K]> };

const TOKENS = {
  accessToken: 'eyJhbGciOiJSUzI1NiJ9.access-token.signature',
  accessTokenExpiresAt: new Date('2026-11-03T09:20:00.000Z'),
  refreshToken: 'eyJhbGciOiJIUzUxMiJ9.refresh-token.signature',
  keycloakSessionId: 'keycloak-session-1',
};

describe('session adapter', () => {
  const prisma = getPrisma();
  const cipher = createTokenCipher(getEnv().authSecret);
  let adapter: SessionAdapter;
  /** The current time of the adapters; a test moves it forward. */
  let now = new Date();

  function adapterOf(signIn: SignInTokens): SessionAdapter {
    return createSessionAdapter({
      prisma,
      cipher,
      keycloak: createKeycloakClient(getEnv().keycloak),
      signIn,
      now: () => now,
    }) as SessionAdapter;
  }

  beforeAll(() => {
    adapter = adapterOf({ current: TOKENS, accountKind: 'end_user' });
  });

  beforeEach(() => {
    now = new Date();
  });

  async function signIn(sub = randomUUID(), signInAdapter = adapter) {
    const sessionToken = randomUUID();
    const { expires } = await signInAdapter.createSession({
      sessionToken,
      userId: sub,
      expires: new Date(now.getTime() + 86_400_000),
    });
    return { sessionToken, sub, expires };
  }

  /** Records the logout requests of Keycloak. */
  function keycloakLogout() {
    const ended = vi.fn();
    mswServer.use(
      http.post(`${KEYCLOAK_ENDPOINTS}/logout`, async ({ request }) => {
        ended(Object.fromEntries(new URLSearchParams(await request.text())));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    return ended;
  }

  function minutesLater(count: number): Date {
    return new Date(now.getTime() + count * 60_000);
  }

  it('links the session to the Keycloak user of the sign-in', async () => {
    const sub = randomUUID();

    const user = await adapter.getUserByAccount({ provider: 'keycloak', providerAccountId: sub });

    expect(user).toMatchObject({ id: sub });
  });

  it('stores a hash of the session token and the Keycloak tokens encrypted', async () => {
    const { sessionToken, sub } = await signIn();

    const row = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(sessionToken) },
    });
    expect(row).toMatchObject({
      keycloakUserId: sub,
      keycloakSessionId: 'keycloak-session-1',
      accessTokenExpiresAt: TOKENS.accessTokenExpiresAt,
    });
    expect(JSON.stringify(row)).not.toContain(sessionToken);
    expect(JSON.stringify(row)).not.toContain(TOKENS.accessToken);
    expect(JSON.stringify(row)).not.toContain(TOKENS.refreshToken);
    await expect(cipher.decrypt(row.accessToken)).resolves.toBe(TOKENS.accessToken);
    await expect(cipher.decrypt(row.refreshToken)).resolves.toBe(TOKENS.refreshToken);
  });

  it('signs the user out on the next request once the session row is deleted', async () => {
    const { sessionToken, sub, expires } = await signIn();
    await expect(adapter.getSessionAndUser(sessionToken)).resolves.toEqual({
      session: { sessionToken, userId: sub, expires },
      user: { id: sub, email: '', emailVerified: null },
    });

    await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(sessionToken) } });

    await expect(adapter.getSessionAndUser(sessionToken)).resolves.toBeNull();
  });

  it('refuses to create a session without the tokens of a sign-in', async () => {
    const withoutSignIn = createSessionAdapter({
      prisma,
      cipher,
      keycloak: createKeycloakClient(getEnv().keycloak),
    }) as SessionAdapter;

    await expect(
      withoutSignIn.createSession({
        sessionToken: randomUUID(),
        userId: randomUUID(),
        expires: new Date(),
      }),
    ).rejects.toThrow('A session is created only by a sign-in with Keycloak');
  });

  it('gives an end-user session the lifetimes of end users', async () => {
    const { sessionToken, expires } = await signIn();

    expect(expires).toEqual(minutesLater(30 * 24 * 60));
    expect(
      await prisma.session.findUniqueOrThrow({
        where: { tokenHash: hashSessionToken(sessionToken) },
        select: { expiresAt: true, idleExpiresAt: true, idleTimeoutSeconds: true },
      }),
    ).toEqual({
      expiresAt: expires,
      idleExpiresAt: minutesLater(8 * 60),
      idleTimeoutSeconds: 28_800,
    });
  });

  it.each([
    ['a team member', 'team' as const],
    ['an account of unknown kind', undefined],
  ])(
    'ends an idle session of %s after 30 minutes with its Keycloak session',
    async (_case, kind) => {
      const { sessionToken } = await signIn(
        randomUUID(),
        adapterOf({ current: TOKENS, accountKind: kind }),
      );
      const ended = keycloakLogout();
      const signedIn = now;

      now = minutesLater(29);
      await expect(adapter.getSessionAndUser(sessionToken)).resolves.not.toBeNull();
      // 29 minutes after the last request.
      now = new Date(signedIn.getTime() + 58 * 60_000);
      await expect(adapter.getSessionAndUser(sessionToken)).resolves.not.toBeNull();
      now = new Date(signedIn.getTime() + 88 * 60_000);

      await expect(adapter.getSessionAndUser(sessionToken)).resolves.toBeNull();
      expect(
        await prisma.session.count({ where: { tokenHash: hashSessionToken(sessionToken) } }),
      ).toBe(0);
      expect(ended).toHaveBeenCalledWith(
        expect.objectContaining({ refresh_token: TOKENS.refreshToken }),
      );
    },
  );

  it('ends an active team session after 12 hours', async () => {
    const { sessionToken, expires } = await signIn(
      randomUUID(),
      adapterOf({ current: TOKENS, accountKind: 'team' }),
    );
    keycloakLogout();
    const signedIn = now;
    for (let minute = 25; minute < 12 * 60; minute += 25) {
      now = new Date(signedIn.getTime() + minute * 60_000);
      await expect(adapter.getSessionAndUser(sessionToken)).resolves.not.toBeNull();
    }

    now = expires;

    await expect(adapter.getSessionAndUser(sessionToken)).resolves.toBeNull();
  });

  it('never extends the maximum lifetime of a session', async () => {
    const { sessionToken, expires } = await signIn();

    await adapter.updateSession({ sessionToken, expires: minutesLater(60 * 24 * 60) });

    const result = await adapter.getSessionAndUser(sessionToken);
    expect(result?.session.expires).toEqual(expires);
  });

  it('deletes the session on sign-out and ends its Keycloak session', async () => {
    const { sessionToken } = await signIn();
    const ended = keycloakLogout();

    await adapter.deleteSession(sessionToken);

    await expect(adapter.getSessionAndUser(sessionToken)).resolves.toBeNull();
    expect(ended).toHaveBeenCalledWith({
      client_id: 'trybun-web',
      client_secret: 'web-client-secret',
      refresh_token: TOKENS.refreshToken,
    });
  });

  it('accepts a Keycloak session that has already ended', async () => {
    const { sessionToken } = await signIn();
    mswServer.use(
      http.post(`${KEYCLOAK_ENDPOINTS}/logout`, () =>
        HttpResponse.json({ error: 'invalid_grant' }, { status: 400 }),
      ),
    );

    await expect(adapter.deleteSession(sessionToken)).resolves.toBeUndefined();
  });

  it('reports a failed Keycloak logout after deleting the session', async () => {
    const { sessionToken } = await signIn();
    mswServer.use(
      http.post(`${KEYCLOAK_ENDPOINTS}/logout`, () => new HttpResponse(null, { status: 401 })),
    );

    await expect(adapter.deleteSession(sessionToken)).rejects.toThrow('status 401');
    await expect(adapter.getSessionAndUser(sessionToken)).resolves.toBeNull();
  });

  it('ignores the sign-out of an unknown session', async () => {
    await expect(adapter.deleteSession(randomUUID())).resolves.toBeUndefined();
  });
});
