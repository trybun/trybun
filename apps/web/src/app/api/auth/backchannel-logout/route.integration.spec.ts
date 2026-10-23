import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession } from '../../../../../test/factories/session.factory.js';
import {
  keycloakJwksHandler,
  signLogoutToken,
} from '../../../../../test/factories/keycloak-tokens.js';
import { mswServer } from '../../../../../test/msw/server.js';
import { stubIntegrationEnv } from '../../../../../test/setup/environment.js';

vi.mock('server-only', () => ({}));
stubIntegrationEnv();

const { getPrisma } = await import('../../../../lib/database/prisma.js');
const { POST } = await import('./route.js');

function logout(body: BodyInit | null): Promise<Response> {
  return POST(
    new Request('http://web:3000/api/auth/backchannel-logout', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    }),
  );
}

describe('POST /api/auth/backchannel-logout', () => {
  const prisma = getPrisma();

  beforeEach(() => {
    mswServer.use(keycloakJwksHandler);
  });

  async function sessionsOf(keycloakUserId: string): Promise<string[]> {
    const sessions = await prisma.session.findMany({ where: { keycloakUserId } });
    return sessions.map((session) => session.keycloakSessionId);
  }

  it('deletes the web sessions of the ended Keycloak session only', async () => {
    const sub = randomUUID();
    await createSession(prisma, { keycloakUserId: sub, keycloakSessionId: 'ended' });
    await createSession(prisma, { keycloakUserId: sub, keycloakSessionId: 'ended' });
    await createSession(prisma, { keycloakUserId: sub, keycloakSessionId: 'other-device' });
    const token = await signLogoutToken({ sub, sid: 'ended' });

    const res = await logout(new URLSearchParams({ logout_token: token }));

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    await expect(sessionsOf(sub)).resolves.toEqual(['other-device']);
  });

  it('deletes all web sessions of the user for a logout token without a session', async () => {
    const sub = randomUUID();
    await createSession(prisma, { keycloakUserId: sub });
    await createSession(prisma, { keycloakUserId: sub });
    const token = await signLogoutToken({ sub, sid: undefined });

    const res = await logout(new URLSearchParams({ logout_token: token }));

    expect(res.status).toBe(200);
    await expect(sessionsOf(sub)).resolves.toEqual([]);
  });

  it.each([
    ['another audience', { aud: 'trybun-api' }, {}],
    ['another issuer', { iss: 'https://evil.example.com/auth/realms/trybun' }, {}],
    ['a key outside the JWKS', {}, { foreignKey: true }],
    ['no logout event', { events: {} }, {}],
    ['a nonce, as an ID token has', { nonce: 'n' }, {}],
    ['neither a session nor a user', { sid: undefined, sub: undefined }, {}],
  ])('rejects a logout token with %s', async (_case, claims, options) => {
    const sub = randomUUID();
    await createSession(prisma, { keycloakUserId: sub, keycloakSessionId: 'kept' });
    const token = await signLogoutToken({ sub, sid: 'kept', ...claims }, options);

    const res = await logout(new URLSearchParams({ logout_token: token }));

    expect(res.status).toBe(400);
    await expect(sessionsOf(sub)).resolves.toEqual(['kept']);
  });

  it.each([
    ['no logout token', new URLSearchParams({})],
    ['a malformed logout token', new URLSearchParams({ logout_token: 'not-a-jwt' })],
    ['a body that is not a form', null],
  ])('rejects a request with %s', async (_case, body) => {
    const res = await logout(body);

    expect(res.status).toBe(400);
  });
});
