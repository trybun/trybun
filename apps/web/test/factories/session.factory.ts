import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';

/** A session row (§14.4); the token columns hold placeholders, not real encrypted tokens. */
export function createSession(
  prisma: PrismaClient,
  overrides: Partial<Prisma.SessionCreateInput> = {},
) {
  return prisma.session.create({
    data: {
      tokenHash: randomUUID(),
      keycloakUserId: randomUUID(),
      keycloakSessionId: randomUUID(),
      accessToken: 'encrypted-access-token',
      accessTokenExpiresAt: new Date(Date.now() + 300_000),
      refreshToken: 'encrypted-refresh-token',
      expiresAt: new Date(Date.now() + 86_400_000),
      ...overrides,
    },
  });
}
