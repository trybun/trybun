import { randomUUID } from 'node:crypto';
import { http, HttpResponse } from 'msw';
import type { Adapter } from 'next-auth/adapters';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { KEYCLOAK_ENDPOINTS } from '../../../test/factories/keycloak-tokens.js';
import { mswServer } from '../../../test/msw/server.js';
import { stubIntegrationEnv } from '../../../test/setup/environment.js';

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

  beforeAll(() => {
    adapter = createSessionAdapter({
      prisma,
      cipher,
      keycloak: createKeycloakClient(getEnv().keycloak),
      signIn: { current: TOKENS },
    }) as SessionAdapter;
  });

  async function signIn(sub = randomUUID()) {
    const sessionToken = randomUUID();
    const expires = new Date(Date.now() + 86_400_000);
    await adapter.createSession({ sessionToken, userId: sub, expires });
    return { sessionToken, sub, expires };
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

  it('extends the expiry of a session', async () => {
    const { sessionToken } = await signIn();
    const expires = new Date(Date.now() + 2 * 86_400_000);

    await adapter.updateSession({ sessionToken, expires });

    const result = await adapter.getSessionAndUser(sessionToken);
    expect(result?.session.expires).toEqual(expires);
  });

  it('deletes the session on sign-out and ends its Keycloak session', async () => {
    const { sessionToken } = await signIn();
    const ended = vi.fn();
    mswServer.use(
      http.post(`${KEYCLOAK_ENDPOINTS}/logout`, async ({ request }) => {
        ended(Object.fromEntries(new URLSearchParams(await request.text())));
        return new HttpResponse(null, { status: 204 });
      }),
    );

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
