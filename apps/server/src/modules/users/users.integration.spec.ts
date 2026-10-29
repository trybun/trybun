import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { UserPage } from '@trybun/contracts/users';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createInvitation } from '../../../test/factories/invitation.factory.js';
import { createProductTourProgress } from '../../../test/factories/product-tour-progress.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { AuthenticationModule } from '../../platform/authentication/authentication.module.js';
import { AuthorizationModule } from '../../platform/authorization/authorization.module.js';
import { ClockModule } from '../../platform/clock/clock.module.js';
import { ConfigModule } from '../../platform/config/config.module.js';
import { DatabaseModule } from '../../platform/database/database.module.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { ErrorsModule } from '../../platform/errors/errors.module.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';
import { HttpModule } from '../../platform/http/http.module.js';
import { LoggingModule } from '../../platform/logging/logging.module.js';
import { administrationAbilities } from '../administration/administration.abilities.js';
import { organizationsAbilities } from '../organizations/organizations.abilities.js';
import { projectsAbilities } from '../projects/projects.abilities.js';
import { usersAbilities } from './users.abilities.js';
import { UsersModule } from './users.module.js';

describe('users endpoints', () => {
  const config = integrationConfig();
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(config),
        LoggingModule.forRoot(),
        ClockModule,
        DatabaseModule,
        ErrorsModule,
        HttpModule,
        AuthenticationModule,
        AuthorizationModule.forRoot({
          rules: [
            administrationAbilities,
            projectsAbilities,
            organizationsAbilities,
            usersAbilities,
          ],
          restrictions: [],
        }),
        UsersModule,
      ],
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

  async function signIn(overrides: Parameters<typeof createUser>[1] = {}) {
    const user = await createUser(prisma, { keycloakUserId: randomUUID(), ...overrides });
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      ...(user.kind === 'team' ? { amr: ['pwd', 'otp'] } : {}),
    });
    return { user, authorization: `Bearer ${token}` };
  }

  /** An Administrator; the API needs 2FA for team accounts. */
  function signInAsAdministrator() {
    return signIn({ kind: 'team', isAdmin: true });
  }

  /** A web session of a Keycloak user, as the web application writes it at sign-in (§14.4). */
  function createSession(keycloakUserId: string) {
    const later = new Date(Date.now() + 60 * 60 * 1000);
    return prisma.session.create({
      data: {
        tokenHash: randomUUID(),
        keycloakUserId,
        keycloakSessionId: randomUUID(),
        accessToken: 'encrypted',
        accessTokenExpiresAt: later,
        refreshToken: 'encrypted',
        expiresAt: later,
        idleTimeoutSeconds: 3600,
        idleExpiresAt: later,
      },
    });
  }

  function auditEntries(targetId: string) {
    return prisma.auditLogEntry.findMany({
      where: { targetId },
      select: { action: true, actorId: true, targetType: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  function outboxEvents(userId: string) {
    return prisma.outboxEvent.findMany({
      where: { payload: { equals: { userId } } },
      select: { type: true, payload: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  it('returns the account of the token subject', async () => {
    const user = await createUser(prisma, { keycloakUserId: randomUUID() });
    const token = await signAccessToken(config, { sub: user.keycloakUserId ?? '' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      kind: 'end_user',
      language: user.language,
      timeZone: 'Europe/Warsaw',
      allowedActions: [],
    });
  });

  it('allows an Administrator to open the Administrator panel', async () => {
    const user = await createUser(prisma, {
      kind: 'team',
      isAdmin: true,
      keycloakUserId: randomUUID(),
    });
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: ['pwd', 'otp'],
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body).toMatchObject({
      kind: 'team',
      allowedActions: ['open_administration', 'create_project', 'create_organization'],
    });
  });

  it('requires a signed-in account', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/users/me');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'authentication.required' });
  });

  describe('product tour progress', () => {
    it('lists only the progress of the signed-in person', async () => {
      const { user, authorization } = await signIn();
      const other = await createUser(prisma);
      await createProductTourProgress(prisma, user.id, {
        tourId: 'first_login',
        tourVersion: 2,
        status: 'skipped',
      });
      await createProductTourProgress(prisma, other.id, { tourId: 'first_login' });
      // A tour removed from the closed list is kept but not returned.
      await createProductTourProgress(prisma, user.id, { tourId: 'removed_tour' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me/product-tours')
        .set('Authorization', authorization);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        items: [
          {
            tourId: 'first_login',
            tourVersion: 2,
            status: 'skipped',
            updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.+Z$/) as unknown,
          },
        ],
        nextCursor: null,
      });
    });

    it('records a tour and replaces the record on the next end of it', async () => {
      const { user, authorization } = await signIn();
      const put = (body: object) =>
        request(app.getHttpServer())
          .put('/api/v1/users/me/product-tours/first_login')
          .set('Authorization', authorization)
          .send(body);

      const skipped = await put({ tourVersion: 1, status: 'skipped' });
      const completed = await put({ tourVersion: 2, status: 'completed' });

      expect(skipped.status).toBe(200);
      expect(skipped.body).toMatchObject({
        tourId: 'first_login',
        tourVersion: 1,
        status: 'skipped',
      });
      expect(completed.status).toBe(200);
      expect(completed.body).toMatchObject({ tourVersion: 2, status: 'completed' });
      expect(
        await prisma.productTourProgress.findMany({
          where: { userId: user.id },
          select: { tourId: true, tourVersion: true, status: true },
        }),
      ).toEqual([{ tourId: 'first_login', tourVersion: 2, status: 'completed' }]);
    });

    it.each([
      ['an unknown tour', 'unknown_tour', { tourVersion: 1, status: 'completed' }, '/tourId'],
      [
        'an invalid version',
        'first_login',
        { tourVersion: 0, status: 'completed' },
        '/tourVersion',
      ],
      ['an unknown status', 'first_login', { tourVersion: 1, status: 'started' }, '/status'],
    ])('rejects %s with 422', async (_case, tourId, body, pointer) => {
      const { authorization } = await signIn();

      const res = await request(app.getHttpServer())
        .put(`/api/v1/users/me/product-tours/${tourId}`)
        .set('Authorization', authorization)
        .send(body);

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        code: 'request.validation_failed',
        errors: [expect.objectContaining({ pointer }) as unknown],
      });
    });

    it('requires a signed-in account', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/users/me/product-tours/first_login')
        .send({ tourVersion: 1, status: 'completed' });

      expect(res.status).toBe(401);
    });
  });
  describe('settings of the own account', () => {
    function patch(authorization: string, body: object) {
      return request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', authorization)
        .send(body);
    }

    it('changes the language and the time zone', async () => {
      const { user, authorization } = await signIn({ language: 'en', timeZone: null });

      const res = await patch(authorization, { language: 'pl', timeZone: 'America/New_York' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: user.id, language: 'pl', timeZone: 'America/New_York' });
      expect(
        await prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { language: true, timeZone: true },
        }),
      ).toEqual({ language: 'pl', timeZone: 'America/New_York' });
    });

    it('keeps a setting that is not sent and returns to the system time zone with null', async () => {
      const { authorization } = await signIn({ language: 'pl', timeZone: 'Europe/Warsaw' });

      const res = await patch(authorization, { timeZone: null });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ language: 'pl', timeZone: null });
    });

    it.each([
      ['an unknown time zone', { timeZone: 'Mars/Olympus_Mons' }, '/timeZone'],
      ['an unsupported language', { language: 'de' }, '/language'],
    ])('rejects %s with 422', async (_case, body, pointer) => {
      const { authorization } = await signIn();

      const res = await patch(authorization, body);

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        code: 'request.validation_failed',
        errors: [expect.objectContaining({ pointer }) as unknown],
      });
    });

    it('rejects a change without a setting with 422', async () => {
      const { authorization } = await signIn();

      const res = await patch(authorization, {});

      expect(res.status).toBe(422);
    });
  });

  describe('accounts list', () => {
    function pageOf(res: { body: unknown }): UserPage {
      return res.body as UserPage;
    }

    function idsOf(res: { body: unknown }): string[] {
      return pageOf(res).items.map((item) => item.id);
    }

    function list(authorization: string, query: Record<string, string>) {
      return request(app.getHttpServer())
        .get('/api/v1/users')
        .query(query)
        .set('Authorization', authorization);
    }

    it('lists the accounts by display name with their allowed actions, filtered and searched', async () => {
      const { user: admin, authorization } = await signInAsAdministrator();
      const tag = randomUUID().slice(0, 8);
      const zofia = await createUser(prisma, {
        displayName: `Zofia ${tag}`,
        kind: 'team',
        isAdmin: true,
      });
      const anna = await createUser(prisma, { displayName: `Anna ${tag}`, kind: 'team' });
      const invited = await createUser(prisma, {
        displayName: null,
        email: `invited-${tag}@example.com`,
        kind: 'end_user',
        state: 'invited',
      });
      const gone = await createUser(prisma, {
        displayName: `Gone ${tag}`,
        state: 'deactivated',
      });

      const all = await list(authorization, { query: tag.toUpperCase() });
      const teamOnly = await list(authorization, { query: tag, kind: 'team' });
      const deactivated = await list(authorization, { query: tag, state: 'deactivated' });
      const byAddress = await list(authorization, { query: `invited-${tag}@` });

      expect(all.status).toBe(200);
      expect(idsOf(all)).toEqual([anna.id, gone.id, zofia.id, invited.id]);
      expect(pageOf(all).items[0]).toEqual({
        id: anna.id,
        displayName: anna.displayName,
        email: anna.email,
        kind: 'team',
        state: 'active',
        isAdmin: false,
        githubLogin: null,
        createdAt: anna.createdAt.toISOString(),
        allowedActions: ['deactivate', 'grant_admin'],
      });
      expect(pageOf(all).items[1]?.allowedActions).toEqual(['reactivate']);
      expect(pageOf(all).items[2]?.allowedActions).toEqual(['deactivate', 'revoke_admin']);
      expect(pageOf(all).items[3]?.allowedActions).toEqual(['deactivate']);
      expect(idsOf(teamOnly)).toEqual([anna.id, zofia.id]);
      expect(idsOf(deactivated)).toEqual([gone.id]);
      expect(idsOf(byAddress)).toEqual([invited.id]);
      expect(admin.isAdmin).toBe(true);
    });

    it('pages with a cursor', async () => {
      const { authorization } = await signInAsAdministrator();
      const tag = randomUUID().slice(0, 8);
      const accounts = [
        await createUser(prisma, { displayName: `A ${tag}` }),
        await createUser(prisma, { displayName: `B ${tag}` }),
        await createUser(prisma, { displayName: null, email: `c-${tag}@example.com` }),
      ];

      const first = await list(authorization, { query: tag, limit: '2' });
      const second = await list(authorization, {
        query: tag,
        limit: '2',
        cursor: pageOf(first).nextCursor ?? '',
      });

      expect(idsOf(first)).toEqual([accounts[0]?.id, accounts[1]?.id]);
      expect(second.body).toEqual({
        items: [expect.objectContaining({ id: accounts[2]?.id }) as unknown],
        nextCursor: null,
      });
    });

    it.each([
      ['a team member', { kind: 'team' as const }],
      ['an end user', {}],
    ])('is not found for %s', async (_case, overrides) => {
      const { authorization } = await signIn(overrides);

      const res = await list(authorization, {});

      expect(res.status).toBe(404);
    });
  });

  describe('deactivation', () => {
    function deactivate(authorization: string, userId: string) {
      return request(app.getHttpServer())
        .post(`/api/v1/users/${userId}/deactivation`)
        .set('Authorization', authorization);
    }

    it('refuses the next request, deletes the web sessions and revokes the pending invitations', async () => {
      const { user: admin, authorization } = await signInAsAdministrator();
      const { user: target, authorization: targetAuthorization } = await signIn({ kind: 'team' });
      const keycloakUserId = target.keycloakUserId ?? '';
      await createSession(keycloakUserId);
      await createSession(keycloakUserId);
      const otherSession = await createSession(randomUUID());
      const pending = await createInvitation(prisma, { userId: target.id, invitedById: admin.id });
      const used = await createInvitation(prisma, {
        userId: target.id,
        invitedById: admin.id,
        usedAt: new Date(),
      });

      const before = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', targetAuthorization);
      const res = await deactivate(authorization, target.id);
      const after = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', targetAuthorization);

      expect(before.status).toBe(200);
      expect(res.status).toBe(204);
      expect(after.status).toBe(401);
      expect(after.body).toMatchObject({ code: 'authentication.required' });
      expect(await prisma.session.count({ where: { keycloakUserId } })).toBe(0);
      expect(await prisma.session.count({ where: { id: otherSession.id } })).toBe(1);
      const invitations = await prisma.invitation.findMany({
        where: { userId: target.id },
        select: { id: true, revokedAt: true },
      });
      expect(invitations).toEqual(
        expect.arrayContaining([
          { id: pending.id, revokedAt: expect.any(Date) as unknown },
          { id: used.id, revokedAt: null },
        ]),
      );
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: target.id }, select: { state: true } }),
      ).toEqual({ state: 'deactivated' });
      expect(await auditEntries(target.id)).toEqual([
        { action: 'user.deactivated', actorId: admin.id, targetType: 'User' },
      ]);
      expect(await auditEntries(pending.id)).toEqual([
        { action: 'invitation.revoked', actorId: null, targetType: 'Invitation' },
      ]);
      expect(await outboxEvents(target.id)).toEqual([
        { type: 'user.deactivated', payload: { userId: target.id } },
      ]);
    });

    it('deactivates an invited account', async () => {
      const { authorization } = await signInAsAdministrator();
      const invited = await createUser(prisma, { state: 'invited', displayName: null });

      const res = await deactivate(authorization, invited.id);

      expect(res.status).toBe(204);
    });

    it('refuses to deactivate the own account while other Administrators exist', async () => {
      const { user: admin, authorization } = await signInAsAdministrator();
      await createUser(prisma, { kind: 'team', isAdmin: true });

      const res = await deactivate(authorization, admin.id);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'request.forbidden' });
    });

    it('refuses to deactivate an account twice', async () => {
      const { authorization } = await signInAsAdministrator();
      const target = await createUser(prisma, { state: 'deactivated' });

      const res = await deactivate(authorization, target.id);

      expect(res.status).toBe(403);
    });

    it.each([
      ['a team member', { kind: 'team' as const }],
      ['an end user', {}],
    ])('is not found for %s', async (_case, overrides) => {
      const { authorization } = await signIn(overrides);
      const target = await createUser(prisma);

      const res = await deactivate(authorization, target.id);

      expect(res.status).toBe(404);
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: target.id }, select: { state: true } }),
      ).toEqual({ state: 'active' });
    });

    it('is not found for an unknown account', async () => {
      const { authorization } = await signInAsAdministrator();

      const res = await deactivate(authorization, randomUUID());

      expect(res.status).toBe(404);
    });
  });

  describe('reactivation', () => {
    function reactivate(authorization: string, userId: string) {
      return request(app.getHttpServer())
        .post(`/api/v1/users/${userId}/reactivation`)
        .set('Authorization', authorization);
    }

    it('returns an account with a Keycloak user to active', async () => {
      const { user: admin, authorization } = await signInAsAdministrator();
      const target = await createUser(prisma, {
        state: 'deactivated',
        keycloakUserId: randomUUID(),
      });

      const res = await reactivate(authorization, target.id);

      expect(res.status).toBe(204);
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: target.id }, select: { state: true } }),
      ).toEqual({ state: 'active' });
      expect(await auditEntries(target.id)).toEqual([
        { action: 'user.reactivated', actorId: admin.id, targetType: 'User' },
      ]);
      expect(await outboxEvents(target.id)).toEqual([
        { type: 'user.reactivated', payload: { userId: target.id } },
      ]);
    });

    it('returns an account without a Keycloak user to invited', async () => {
      const { authorization } = await signInAsAdministrator();
      const target = await createUser(prisma, { state: 'deactivated' });

      const res = await reactivate(authorization, target.id);

      expect(res.status).toBe(204);
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: target.id }, select: { state: true } }),
      ).toEqual({ state: 'invited' });
    });

    it('refuses an account that is not deactivated', async () => {
      const { authorization } = await signInAsAdministrator();
      const target = await createUser(prisma);

      const res = await reactivate(authorization, target.id);

      expect(res.status).toBe(403);
    });
  });

  describe('Administrator role', () => {
    function grant(authorization: string, userId: string) {
      return request(app.getHttpServer())
        .put(`/api/v1/users/${userId}/administrator-role`)
        .set('Authorization', authorization);
    }

    function revoke(authorization: string, userId: string) {
      return request(app.getHttpServer())
        .delete(`/api/v1/users/${userId}/administrator-role`)
        .set('Authorization', authorization);
    }

    async function isAdmin(userId: string) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { isAdmin: true },
      });
      return user.isAdmin;
    }

    it('grants and revokes the role idempotently, each change with its audit entry', async () => {
      const { user: admin, authorization } = await signInAsAdministrator();
      const target = await createUser(prisma, { kind: 'team' });

      const granted = [
        await grant(authorization, target.id),
        await grant(authorization, target.id),
      ];
      const isAdminAfterGrant = await isAdmin(target.id);
      const revoked = [
        await revoke(authorization, target.id),
        await revoke(authorization, target.id),
      ];

      expect(granted.map((res) => res.status)).toEqual([204, 204]);
      expect(isAdminAfterGrant).toBe(true);
      expect(revoked.map((res) => res.status)).toEqual([204, 204]);
      expect(await isAdmin(target.id)).toBe(false);
      expect(await auditEntries(target.id)).toEqual([
        { action: 'user.admin_granted', actorId: admin.id, targetType: 'User' },
        { action: 'user.admin_revoked', actorId: admin.id, targetType: 'User' },
      ]);
    });

    it.each([
      ['an end user', { kind: 'end_user' as const }],
      ['a deactivated team account', { kind: 'team' as const, state: 'deactivated' as const }],
    ])('refuses to grant the role to %s', async (_case, overrides) => {
      const { authorization } = await signInAsAdministrator();
      const target = await createUser(prisma, overrides);

      const res = await grant(authorization, target.id);

      expect(res.status).toBe(403);
      expect(await isAdmin(target.id)).toBe(false);
    });

    it('refuses to revoke the own role while other Administrators exist', async () => {
      const { user: admin, authorization } = await signInAsAdministrator();
      await createUser(prisma, { kind: 'team', isAdmin: true });

      const res = await revoke(authorization, admin.id);

      expect(res.status).toBe(403);
      expect(await isAdmin(admin.id)).toBe(true);
    });

    it('is not found for a team member', async () => {
      const { authorization } = await signIn({ kind: 'team' });
      const target = await createUser(prisma, { kind: 'team' });

      const res = await grant(authorization, target.id);

      expect(res.status).toBe(404);
    });
  });
});
