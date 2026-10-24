import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { API_PREFIX } from '../http/api-prefix.js';
import { ErrorsModule } from '../errors/errors.module.js';
import { HttpModule } from '../http/http.module.js';
import { LoggingModule } from '../logging/logging.module.js';
import { ResponseSchema } from '../http/response-schema.decorator.js';
import { AuthenticationModule } from './authentication.module.js';
import { CurrentPrincipal } from './current-principal.decorator.js';
import type { Principal } from './principal.js';
import { Public } from './public.decorator.js';

const principalSchema = z.object({
  kind: z.literal('user'),
  userId: z.uuid(),
  userKind: z.enum(['team', 'end_user']),
  isAdmin: z.boolean(),
});

@Controller('principal')
class PrincipalController {
  @Get()
  @ResponseSchema(principalSchema)
  get(@CurrentPrincipal() principal: Principal): Principal {
    return principal;
  }

  @Get('public')
  @Public()
  @ResponseSchema(z.object({ ok: z.boolean() }))
  getPublic() {
    return { ok: true };
  }
}

const UNAUTHENTICATED = {
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
  code: 'authentication.required',
};

describe('authentication', () => {
  const config = integrationConfig();
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  function get(token?: string) {
    const req = request(app.getHttpServer()).get('/api/v1/principal');
    return token === undefined ? req : req.set('Authorization', `Bearer ${token}`);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(config),
        LoggingModule.forRoot(),
        DatabaseModule,
        ErrorsModule,
        HttpModule,
        AuthenticationModule,
      ],
      controllers: [PrincipalController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    mswServer.use(keycloakJwksHandler(config));
  });

  afterAll(async () => {
    await app.close();
  });

  it('resolves the principal of the account linked to the token subject', async () => {
    const user = await createUser(prisma, { keycloakUserId: randomUUID() });

    const res = await get(await signAccessToken(config, { sub: user.keycloakUserId ?? '' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      kind: 'user',
      userId: user.id,
      userKind: 'end_user',
      isAdmin: false,
    });
  });

  it('accepts a team member who signed in with 2FA', async () => {
    const user = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'team' });

    const res = await get(
      await signAccessToken(config, { sub: user.keycloakUserId ?? '', amr: ['pwd', 'otp'] }),
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: user.id, userKind: 'team' });
  });

  it('rejects a team member whose sign-in did not complete 2FA', async () => {
    const user = await createUser(prisma, { keycloakUserId: randomUUID(), kind: 'team' });

    const res = await get(
      await signAccessToken(config, { sub: user.keycloakUserId ?? '', amr: ['pwd'] }),
    );

    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer error="insufficient_user_authentication"');
    expect(res.body).toEqual({
      ...UNAUTHENTICATED,
      code: 'authentication.second_factor_required',
    });
  });

  it.each([
    ['a wrong audience', { aud: 'trybun-web' }, {}],
    ['a wrong issuer', { iss: 'https://evil.example.com/auth/realms/trybun' }, {}],
    ['the issuer of another realm', { iss: 'https://trybun.example.com/auth/realms/master' }, {}],
    ['an expired token', {}, { expiresIn: -60 }],
    ['a key outside the JWKS', {}, { foreignKey: true }],
  ])('rejects a token with %s', async (_case, claims, options) => {
    const user = await createUser(prisma, { keycloakUserId: randomUUID() });

    const res = await get(
      await signAccessToken(config, { sub: user.keycloakUserId ?? '', ...claims }, options),
    );

    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.body).toEqual(UNAUTHENTICATED);
  });

  it('rejects a token signed with another algorithm', async () => {
    const user = await createUser(prisma, { keycloakUserId: randomUUID() });
    const token = await new SignJWT({ sub: user.keycloakUserId ?? '', aud: 'trybun-api' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(config.keycloak.issuer)
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('a shared secret of at least 32 bytes'));

    const res = await get(token);

    expect(res.status).toBe(401);
  });

  it.each([
    ['no Authorization header', undefined],
    ['a malformed token', 'not-a-jwt'],
    ['an API token, which is never parsed as a JWT', 'trybun_pat_abcdef'],
  ])('rejects a request with %s', async (_case, token) => {
    const res = await get(token);

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHENTICATED);
  });

  it.each(['invited', 'deactivated', 'anonymized'] as const)(
    'rejects a valid token of an %s account',
    async (state) => {
      const user = await createUser(prisma, { keycloakUserId: randomUUID(), state });

      const res = await get(await signAccessToken(config, { sub: user.keycloakUserId ?? '' }));

      expect(res.status).toBe(401);
    },
  );

  it('rejects a valid token of a Keycloak user without an account', async () => {
    const res = await get(await signAccessToken(config, { sub: randomUUID() }));

    expect(res.status).toBe(401);
  });

  it('lets a public endpoint through without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/principal/public');

    expect(res.status).toBe(200);
  });
});
