import { randomUUID } from 'node:crypto';
import { http, HttpResponse } from 'msw';
import { NextRequest } from 'next/server.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYCLOAK_ENDPOINTS } from '../../../../../test/factories/keycloak-tokens.js';
import { createSession } from '../../../../../test/factories/session.factory.js';
import { mswServer } from '../../../../../test/msw/server.js';
import { TEST_ENV } from '../../../../../test/env.js';
import { stubIntegrationEnv } from '../../../../../test/setup/environment.js';

vi.mock('server-only', () => ({}));
stubIntegrationEnv();

const { getPrisma } = await import('../../../../lib/database/prisma.js');
const { getEnv } = await import('../../../../lib/env/env.js');
const { hashSessionToken } = await import('../../../../lib/auth/session-adapter.js');
const { createTokenCipher } = await import('../../../../lib/auth/token-cipher.js');
const { GET, POST } = await import('./route.js');

const WEB_URL = TEST_ENV.NEXTAUTH_URL;
const API_URL = TEST_ENV.TRYBUN_API_URL;
// HTTPS: Auth.js 4 prefixes the session cookie with `__Secure-`.
const SESSION_COOKIE = '__Secure-next-auth.session-token';

/** The requests that reached the API, as the API received them. */
let received: { headers: Headers; body: string }[];

/** The API answers every request with the method and the path it received. */
function apiHandler() {
  return http.all(`${API_URL}/api/v1/*`, async ({ request }) => {
    received.push({ headers: request.headers, body: await request.text() });
    const url = new URL(request.url);
    return HttpResponse.json(
      { method: request.method, path: `${url.pathname}${url.search}` },
      { status: 201, headers: { 'x-request-id': 'request-1' } },
    );
  });
}

describe('BFF endpoint /api/v1/*', () => {
  const prisma = getPrisma();
  const cipher = createTokenCipher(getEnv().authSecret);

  beforeEach(() => {
    received = [];
    mswServer.use(apiHandler());
  });

  /** A signed-in session; its access token expires in `expiresIn` milliseconds. */
  async function signIn(expiresIn = 300_000) {
    const sessionToken = randomUUID();
    await createSession(prisma, {
      tokenHash: hashSessionToken(sessionToken),
      accessToken: await cipher.encrypt('access-token-1'),
      accessTokenExpiresAt: new Date(Date.now() + expiresIn),
      refreshToken: await cipher.encrypt('refresh-token-1'),
    });
    return sessionToken;
  }

  function request(path: string, init: { method?: string; headers?: HeadersInit; body?: string } = {}) {
    return new NextRequest(`${WEB_URL}${path}`, init);
  }

  it('forwards a request with the access token of the session and without cookies', async () => {
    const sessionToken = await signIn();

    const res = await GET(
      request('/api/v1/users/me?limit=5', {
        headers: { cookie: `${SESSION_COOKIE}=${sessionToken}; NEXT_LOCALE=pl` },
      }),
    );

    expect(res.status).toBe(201);
    expect(res.headers.get('x-request-id')).toBe('request-1');
    await expect(res.json()).resolves.toEqual({ method: 'GET', path: '/api/v1/users/me?limit=5' });
    expect(received[0]?.headers.get('authorization')).toBe('Bearer access-token-1');
    expect(received[0]?.headers.get('cookie')).toBeNull();
  });

  it('forwards a request without a session without credentials', async () => {
    const res = await GET(request('/api/v1/users/me'));

    expect(res.status).toBe(201);
    expect(received[0]?.headers.get('authorization')).toBeNull();
  });

  describe('token refresh', () => {
    let refreshes: URLSearchParams[];

    beforeEach(() => {
      refreshes = [];
      mswServer.use(
        http.post(`${KEYCLOAK_ENDPOINTS}/token`, async ({ request: tokenRequest }) => {
          const form = new URLSearchParams(await tokenRequest.text());
          refreshes.push(form);
          return form.get('refresh_token') === 'refresh-token-1'
            ? HttpResponse.json({
                access_token: 'access-token-2',
                expires_in: 300,
                refresh_token: 'refresh-token-2',
              })
            : HttpResponse.json({ error: 'invalid_grant' }, { status: 400 });
        }),
      );
    });

    it('refreshes an expiring access token and stores the rotated tokens', async () => {
      const sessionToken = await signIn(10_000);

      await GET(
        request('/api/v1/users/me', { headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` } }),
      );

      expect(received[0]?.headers.get('authorization')).toBe('Bearer access-token-2');
      expect(refreshes[0]?.get('client_id')).toBe('trybun-web');
      const row = await prisma.session.findUniqueOrThrow({
        where: { tokenHash: hashSessionToken(sessionToken) },
      });
      await expect(cipher.decrypt(row.refreshToken)).resolves.toBe('refresh-token-2');
      expect(row.accessTokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 200_000);
    });

    it('refreshes once for concurrent requests of one session', async () => {
      const sessionToken = await signIn(-1_000);
      const cookie = `${SESSION_COOKIE}=${sessionToken}`;

      await Promise.all(
        Array.from({ length: 5 }, () => GET(request('/api/v1/users/me', { headers: { cookie } }))),
      );

      expect(refreshes).toHaveLength(1);
      expect(received.map((r) => r.headers.get('authorization'))).toEqual(
        Array.from({ length: 5 }, () => 'Bearer access-token-2'),
      );
    });

    it('ends the session when its Keycloak session has ended', async () => {
      const sessionToken = randomUUID();
      await createSession(prisma, {
        tokenHash: hashSessionToken(sessionToken),
        accessToken: await cipher.encrypt('access-token-1'),
        accessTokenExpiresAt: new Date(Date.now() - 1_000),
        refreshToken: await cipher.encrypt('revoked-refresh-token'),
      });

      await GET(
        request('/api/v1/users/me', { headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` } }),
      );

      expect(received[0]?.headers.get('authorization')).toBeNull();
      await expect(
        prisma.session.count({ where: { tokenHash: hashSessionToken(sessionToken) } }),
      ).resolves.toBe(0);
    });
  });

  it('forwards an Authorization header unchanged and without cookies', async () => {
    const res = await POST(
      request('/api/v1/tickets', {
        method: 'POST',
        headers: { authorization: 'Bearer trybun_pat_secret', cookie: 'NEXT_LOCALE=pl' },
        body: '{"title":"Crash"}',
      }),
    );

    expect(res.status).toBe(201);
    expect(received[0]?.headers.get('authorization')).toBe('Bearer trybun_pat_secret');
    expect(received[0]?.headers.get('cookie')).toBeNull();
    expect(received[0]?.body).toBe('{"title":"Crash"}');
  });

  it('rejects a request with both a session cookie and an Authorization header', async () => {
    const sessionToken = await signIn();

    const res = await GET(
      request('/api/v1/users/me', {
        headers: {
          authorization: 'Bearer trybun_pat_secret',
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
      }),
    );

    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    await expect(res.json()).resolves.toMatchObject({ status: 400, code: 'request.malformed' });
    expect(received).toEqual([]);
  });

  describe('CSRF Origin check', () => {
    it.each([
      ['no Origin', {}],
      ['another Origin', { origin: 'https://evil.example.com' }],
      ['the Origin over HTTP', { origin: 'http://trybun.example.com' }],
    ])('rejects a cookie-authenticated POST with %s', async (_case, headers) => {
      const sessionToken = await signIn();

      const res = await POST(
        request('/api/v1/tickets', {
          method: 'POST',
          headers: { ...headers, cookie: `${SESSION_COOKIE}=${sessionToken}` },
          body: '{}',
        }),
      );

      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toMatchObject({ code: 'request.forbidden' });
      expect(received).toEqual([]);
    });

    it('forwards a cookie-authenticated POST from the origin of the web application', async () => {
      const sessionToken = await signIn();

      const res = await POST(
        request('/api/v1/tickets', {
          method: 'POST',
          headers: { origin: WEB_URL, cookie: `${SESSION_COOKIE}=${sessionToken}` },
          body: '{"title":"Crash"}',
        }),
      );

      expect(res.status).toBe(201);
      expect(received[0]?.headers.get('authorization')).toBe('Bearer access-token-1');
      expect(received[0]?.body).toBe('{"title":"Crash"}');
    });

    it('applies to a state-changing request without a session too', async () => {
      const res = await POST(request('/api/v1/tickets', { method: 'POST', body: '{}' }));

      expect(res.status).toBe(403);
    });
  });

  it.each(['/api/v1/webhooks/github', '/api/v1/webhooks/email/postmark'])(
    'forwards a webhook to %s byte for byte, without credentials',
    async (path) => {
      const sessionToken = await signIn();
      const body = '{"action":"opened", "number": 1}\n';

      const res = await POST(
        request(path, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-hub-signature-256': 'sha256=abc',
            cookie: `${SESSION_COOKIE}=${sessionToken}`,
          },
          body,
        }),
      );

      expect(res.status).toBe(201);
      expect(received[0]?.headers.get('x-hub-signature-256')).toBe('sha256=abc');
      expect(received[0]?.headers.get('authorization')).toBeNull();
      expect(received[0]?.headers.get('cookie')).toBeNull();
      expect(received[0]?.body).toBe(body);
    },
  );

  it('answers 503 when the API is unreachable', async () => {
    mswServer.use(http.all(`${API_URL}/api/v1/*`, () => HttpResponse.error()));

    const res = await GET(request('/api/v1/users/me'));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ code: 'server.unavailable' });
  });
});
