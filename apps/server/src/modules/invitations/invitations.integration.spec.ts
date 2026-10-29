import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type {
  CreatedInvitation,
  Invitation,
  InvitationPage,
  InvitationTarget,
  ResentInvitation,
} from '@trybun/contracts/invitations';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import {
  buildInvitationToken,
  createInvitation,
} from '../../../test/factories/invitation.factory.js';
import {
  buildOrganizationDomain,
  createOrganization,
} from '../../../test/factories/organization.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createProjectMember } from '../../../test/factories/project-member.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { keycloakAdminFake, type KeycloakAdminFake } from '../../../test/msw/keycloak-admin.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { AuthenticationModule } from '../../platform/authentication/authentication.module.js';
import { AuthorizationModule } from '../../platform/authorization/authorization.module.js';
import { ClockModule } from '../../platform/clock/clock.module.js';
import { ConfigModule } from '../../platform/config/config.module.js';
import type { TrybunConfig } from '../../platform/config/config.schema.js';
import { DatabaseModule } from '../../platform/database/database.module.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { ErrorsModule } from '../../platform/errors/errors.module.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';
import { HttpModule } from '../../platform/http/http.module.js';
import { TRUSTED_PROXIES } from '../../platform/http/trusted-proxies.js';
import { KeycloakAdminModule } from '../../platform/keycloak-admin/keycloak-admin.module.js';
import { LoggingModule } from '../../platform/logging/logging.module.js';
import {
  archivedOrganizationsRestriction,
  organizationsAbilities,
} from '../organizations/organizations.abilities.js';
import { archivedProjectsRestriction, projectsAbilities } from '../projects/projects.abilities.js';
import { hashInvitationToken } from './domain/invitation-token.js';
import { invitationsAbilities } from './invitations.abilities.js';
import { InvitationsModule } from './invitations.module.js';

type Who = 'admin' | 'project_manager' | 'developer' | 'end_user';

const DAY_MS = 24 * 60 * 60 * 1_000;
/** A password that meets the length rule of the policy (§7.4). */
const PASSWORD = 'a passphrase for the tests';

async function startApp(config: TrybunConfig): Promise<INestApplication<Server>> {
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
        rules: [projectsAbilities, organizationsAbilities, invitationsAbilities],
        restrictions: [archivedProjectsRestriction, archivedOrganizationsRestriction],
      }),
      KeycloakAdminModule,
      InvitationsModule,
    ],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix(API_PREFIX);
  app.set('trust proxy', TRUSTED_PROXIES);
  await app.init();
  return app;
}

/** The error code of a Problem Details response. */
function codeOf(res: { body: unknown }): string | undefined {
  return (res.body as { code?: string }).code;
}

/** The token of an invitation link (ADR 0009). */
function tokenOf(link: string): string {
  return new URL(link).hash.replace('#token=', '');
}

describe('invitations', () => {
  const config: TrybunConfig = { ...integrationConfig(), isGithubSignInConfigured: true };
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let keycloak: KeycloakAdminFake;

  beforeAll(async () => {
    app = await startApp(config);
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    keycloak = keycloakAdminFake(config);
    mswServer.use(keycloakJwksHandler(config), ...keycloak.handlers);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  /** A signed-in account; a team member signed in with 2FA (§7.4). */
  async function signIn(who: Who = 'admin', projectId?: string) {
    const user = await createUser(prisma, {
      keycloakUserId: randomUUID(),
      kind: who === 'end_user' ? 'end_user' : 'team',
      isAdmin: who === 'admin',
    });
    if (projectId !== undefined && (who === 'project_manager' || who === 'developer')) {
      await createProjectMember(prisma, { projectId, userId: user.id, role: who });
    }
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: who === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
    });
    return { user, authorization: `Bearer ${token}` };
  }

  /** A new unique address in another letter case than it is stored in. */
  const newEmail = (domain = 'example.com') => `Person.${randomUUID()}@${domain.toUpperCase()}`;

  function invite(authorization: string, email: string, target: InvitationTarget) {
    return http()
      .post('/api/v1/invitations')
      .set('Authorization', authorization)
      .send({ email, target });
  }

  function preview(authorization: string, email: string, target: InvitationTarget) {
    return http()
      .post('/api/v1/invitation-previews')
      .set('Authorization', authorization)
      .send({ email, target });
  }

  async function auditActions(targetId: string) {
    return prisma.auditLogEntry.findMany({
      where: { targetId },
      select: { action: true, actorId: true, details: true, ipAddress: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  function verify(token: string) {
    return http().post('/api/v1/invitations/token-verification').send({ token });
  }

  function acceptWithPassword(token: string, body: object = {}) {
    return http()
      .post('/api/v1/invitations/acceptance')
      .set('X-Forwarded-For', '203.0.113.7')
      .send({
        method: 'password',
        token,
        firstName: 'Anna',
        lastName: 'Nowak',
        password: PASSWORD,
        language: 'pl',
        timeZone: 'Europe/Warsaw',
        ...body,
      });
  }

  async function acceptWithSession(token: string, sub: string, amr = ['pwd']) {
    return http()
      .post('/api/v1/invitations/acceptance')
      .set('Authorization', `Bearer ${await signAccessToken(config, { sub, amr })}`)
      .send({ method: 'identity_provider', token, language: 'en', timeZone: 'Not/AZone' });
  }

  /** An invitation issued by the Administrator through the API, with its link. */
  async function issued(email: string, target: InvitationTarget) {
    const { authorization } = await signIn();
    const res = await invite(authorization, email, target);
    expect(res.status).toBe(201);
    const created = res.body as Extract<CreatedInvitation, { outcome: 'invited' }>;
    return { invitation: created.invitation, token: tokenOf(created.link) };
  }

  describe('issuing', () => {
    it('creates an invited account and an invitation whose link is shown once', async () => {
      const { user: admin, authorization } = await signIn();
      const project = await createProject(prisma);
      const email = newEmail();
      const before = Date.now();

      const res = await invite(authorization, `  ${email}  `, {
        type: 'project',
        projectId: project.id,
        role: 'developer',
      });

      expect(res.status).toBe(201);
      const created = res.body as Extract<CreatedInvitation, { outcome: 'invited' }>;
      expect(created.outcome).toBe('invited');
      expect(created.link).toMatch(/^https:\/\/trybun\.example\.com\/invitations#token=[\w-]{43}$/);
      expect(created.invitation).toMatchObject({
        user: { email: email.toLowerCase(), displayName: null },
        target: {
          type: 'project',
          project: { id: project.id, key: project.key, name: project.name },
          role: 'developer',
          organization: null,
        },
        invitedBy: { id: admin.id },
        state: 'pending',
        allowedActions: ['resend', 'revoke'],
      });
      const account = await prisma.user.findUniqueOrThrow({
        where: { email: email.toLowerCase() },
      });
      expect(account).toMatchObject({
        kind: 'team',
        state: 'invited',
        keycloakUserId: null,
        language: null,
        timeZone: null,
      });
      const stored = await prisma.invitation.findUniqueOrThrow({
        where: { id: created.invitation.id },
      });
      expect(stored.tokenHash).toBe(hashInvitationToken(tokenOf(created.link)));
      expect(stored.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 7 * DAY_MS);
      expect(stored.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS);
      expect(await auditActions(stored.id)).toEqual([
        {
          action: 'invitation.issued',
          actorId: admin.id,
          details: { userId: account.id, target: 'project' },
          ipAddress: null,
        },
      ]);
      const events = await prisma.outboxEvent.findMany({
        where: {
          type: 'invitation.issued',
          payload: { path: ['invitationId'], equals: stored.id },
        },
      });
      expect(events.map(({ payload }) => payload)).toEqual([
        { invitationId: stored.id, userId: account.id },
      ]);
      expect(JSON.stringify(events)).not.toContain(tokenOf(created.link));
    });

    it.each([
      ['a project with a team role', 'team', (ids: Ids) => projectTarget(ids, 'project_manager')],
      ['a project as an end user', 'end_user', (ids: Ids) => projectTarget(ids, 'end_user')],
      [
        'an organization',
        'end_user',
        (ids: Ids): InvitationTarget => ({
          type: 'organization',
          organizationId: ids.organizationId,
        }),
      ],
      ['the Administrator role', 'team', (): InvitationTarget => ({ type: 'administrator' })],
    ] as const)('invites to %s an account of kind %s', async (_case, kind, target) => {
      const { authorization } = await signIn();
      const ids = await targetIdsOf(prisma);
      const email = newEmail();

      const res = await invite(authorization, email, target(ids));

      expect(res.status).toBe(201);
      expect(await prisma.user.findUnique({ where: { email: email.toLowerCase() } })).toMatchObject(
        { kind, state: 'invited' },
      );
    });

    it('gives an invited account a further invitation with its own link', async () => {
      const { authorization } = await signIn();
      const [first, second] = await Promise.all([createProject(prisma), createProject(prisma)]);
      const email = newEmail();
      const one = await invite(authorization, email, projectTarget({ projectId: first.id }));
      const previewed = await preview(
        authorization,
        email,
        projectTarget({ projectId: second.id }),
      );

      const two = await invite(authorization, email, projectTarget({ projectId: second.id }));

      expect(previewed.body).toEqual({ outcome: 'invite', organization: null });
      expect(two.status).toBe(201);
      const invitations = [one.body, two.body] as Extract<
        CreatedInvitation,
        { outcome: 'invited' }
      >[];
      expect(invitations[0]?.invitation.user.id).toBe(invitations[1]?.invitation.user.id);
      expect(invitations[0]?.link).not.toBe(invitations[1]?.link);
    });

    it('creates one account for two concurrent invitations of one address', async () => {
      const { authorization } = await signIn();
      const [first, second] = await Promise.all([createProject(prisma), createProject(prisma)]);
      const email = newEmail();

      const responses = await Promise.all(
        [first, second].map(({ id }) =>
          invite(authorization, email, projectTarget({ projectId: id })),
        ),
      );

      expect(responses.map(({ status }) => status)).toEqual([201, 201]);
      const accounts = await prisma.user.findMany({
        where: { email: email.toLowerCase() },
        select: { id: true, _count: { select: { invitations: true } } },
      });
      expect(accounts).toHaveLength(1);
      expect(accounts[0]?._count.invitations).toBe(2);
    });

    describe('existing active accounts', () => {
      it('adds an active team account to the project directly, without an invitation', async () => {
        const { user: admin, authorization } = await signIn();
        const project = await createProject(prisma);
        const member = await createUser(prisma, { kind: 'team', displayName: 'Ewa Kowalska' });

        const previewed = await preview(authorization, member.email?.toUpperCase() ?? '', {
          type: 'project',
          projectId: project.id,
          role: 'developer',
        });
        const res = await invite(authorization, member.email?.toUpperCase() ?? '', {
          type: 'project',
          projectId: project.id,
          role: 'developer',
        });

        expect(previewed.body).toEqual({ outcome: 'grant', organization: null });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          outcome: 'access_granted',
          user: { id: member.id, displayName: 'Ewa Kowalska' },
        });
        expect(await prisma.invitation.count({ where: { userId: member.id } })).toBe(0);
        expect(
          await prisma.projectMember.findMany({
            where: { projectId: project.id },
            select: { userId: true, role: true },
          }),
        ).toEqual([{ userId: member.id, role: 'developer' }]);
        expect(await auditActions(project.id)).toEqual([
          {
            action: 'project_member.added',
            actorId: admin.id,
            details: { userId: member.id, role: 'developer' },
            ipAddress: null,
          },
        ]);
        const events = await prisma.outboxEvent.findMany({
          where: { type: 'user.access_granted', payload: { path: ['userId'], equals: member.id } },
        });
        expect(events.map(({ payload }) => payload)).toEqual([
          {
            userId: member.id,
            target: 'project',
            projectId: project.id,
            role: 'developer',
            organizationId: null,
          },
        ]);
      });

      it('adds an end user without an organization to the organization directly', async () => {
        const { authorization } = await signIn();
        const organization = await createOrganization(prisma);
        const endUser = await createUser(prisma);

        const res = await invite(authorization, endUser.email ?? '', {
          type: 'organization',
          organizationId: organization.id,
        });

        expect(res.status).toBe(200);
        expect(
          await prisma.organizationMember.findUnique({ where: { userId: endUser.id } }),
        ).toMatchObject({ organizationId: organization.id });
      });

      it('grants the Administrator role to an active team member directly', async () => {
        const { user: admin, authorization } = await signIn();
        const member = await createUser(prisma, { kind: 'team' });

        const res = await invite(authorization, member.email ?? '', { type: 'administrator' });

        expect(res.status).toBe(200);
        expect(await prisma.user.findUnique({ where: { id: member.id } })).toMatchObject({
          isAdmin: true,
        });
        expect(await auditActions(member.id)).toEqual([
          { action: 'user.admin_granted', actorId: admin.id, details: null, ipAddress: null },
        ]);
      });
    });

    describe('refusals', () => {
      it.each([
        ['an end user to a team role', 'end_user', 'developer'],
        ['a team member as an end user', 'team', 'end_user'],
      ] as const)('refuses %s with invitation.account_kind_mismatch', async (_case, kind, role) => {
        const { authorization } = await signIn();
        const project = await createProject(prisma);
        const account = await createUser(prisma, { kind });
        const target = { type: 'project', projectId: project.id, role } as const;

        for (const res of [
          await preview(authorization, account.email ?? '', target),
          await invite(authorization, account.email ?? '', target),
        ]) {
          expect(res.status).toBe(422);
          expect(res.body).toMatchObject({
            code: 'invitation.account_kind_mismatch',
            errors: [{ pointer: '/email', code: 'field.invalid' }],
          });
        }
      });

      it('refuses a deactivated account with invitation.account_deactivated', async () => {
        const { authorization } = await signIn();
        const account = await createUser(prisma, { kind: 'team', state: 'deactivated' });

        const res = await invite(authorization, account.email ?? '', { type: 'administrator' });

        expect(res.status).toBe(422);
        expect(res.body).toMatchObject({ code: 'invitation.account_deactivated' });
      });

      it('refuses access that exists with invitation.access_exists', async () => {
        const { authorization } = await signIn();
        const project = await createProject(prisma);
        const member = await createUser(prisma, { kind: 'team' });
        await createProjectMember(prisma, { projectId: project.id, userId: member.id });
        const admin = await createUser(prisma, { kind: 'team', isAdmin: true });
        const organization = await createOrganization(prisma);
        await prisma.organizationProject.create({
          data: { organizationId: organization.id, projectId: project.id },
        });
        const endUser = await createUser(prisma);
        await prisma.organizationMember.create({
          data: { organizationId: organization.id, userId: endUser.id },
        });

        const responses = await Promise.all([
          invite(authorization, member.email ?? '', {
            type: 'project',
            projectId: project.id,
            role: 'project_manager',
          }),
          invite(authorization, admin.email ?? '', { type: 'administrator' }),
          invite(authorization, endUser.email ?? '', {
            type: 'organization',
            organizationId: organization.id,
          }),
          // Through the organization, which has the project.
          invite(authorization, endUser.email ?? '', {
            type: 'project',
            projectId: project.id,
            role: 'end_user',
          }),
        ]);

        expect(
          responses.map(({ status, body }) => [status, (body as { code: string }).code]),
        ).toEqual(Array(4).fill([409, 'invitation.access_exists']));
      });

      it('refuses an end user of another organization with invitation.organization_conflict', async () => {
        const { authorization } = await signIn();
        const [own, other] = await Promise.all([
          createOrganization(prisma),
          createOrganization(prisma),
        ]);
        const endUser = await createUser(prisma);
        await prisma.organizationMember.create({
          data: { organizationId: own.id, userId: endUser.id },
        });

        const res = await invite(authorization, endUser.email ?? '', {
          type: 'organization',
          organizationId: other.id,
        });

        expect(res.status).toBe(422);
        expect(res.body).toMatchObject({ code: 'invitation.organization_conflict' });
      });

      it('refuses an archived project or organization with its archived code', async () => {
        const { authorization } = await signIn();
        const project = await createProject(prisma, { state: 'archived' });
        const organization = await createOrganization(prisma, { state: 'archived' });

        const toProject = await invite(authorization, newEmail(), {
          type: 'project',
          projectId: project.id,
          role: 'end_user',
        });
        const toOrganization = await preview(authorization, newEmail(), {
          type: 'organization',
          organizationId: organization.id,
        });

        expect([toProject.status, codeOf(toProject)]).toEqual([409, 'project.archived']);
        expect([toOrganization.status, codeOf(toOrganization)]).toEqual([
          409,
          'organization.archived',
        ]);
      });

      it('answers an unknown project with 404', async () => {
        const { authorization } = await signIn();

        const res = await invite(
          authorization,
          newEmail(),
          projectTarget({ projectId: randomUUID() }),
        );

        expect(res.status).toBe(404);
      });
    });

    describe('who invites', () => {
      it('lets a Project manager invite to their project, but not elsewhere', async () => {
        const [own, other] = await Promise.all([createProject(prisma), createProject(prisma)]);
        const organization = await createOrganization(prisma);
        const { authorization } = await signIn('project_manager', own.id);

        const responses = await Promise.all([
          invite(authorization, newEmail(), projectTarget({ projectId: own.id }, 'end_user')),
          invite(authorization, newEmail(), projectTarget({ projectId: other.id })),
          invite(authorization, newEmail(), { type: 'administrator' }),
          invite(authorization, newEmail(), {
            type: 'organization',
            organizationId: organization.id,
          }),
        ]);

        expect(responses.map(({ status }) => status)).toEqual([201, 404, 403, 404]);
      });

      it('refuses a Developer of the project with 403 and an end user with 404', async () => {
        const project = await createProject(prisma);
        await issued(newEmail(), projectTarget({ projectId: project.id }));
        const developer = await signIn('developer', project.id);
        const endUser = await signIn('end_user');

        const responses = await Promise.all([
          invite(developer.authorization, newEmail(), projectTarget({ projectId: project.id })),
          invite(endUser.authorization, newEmail(), projectTarget({ projectId: project.id })),
          http().get('/api/v1/invitations').set('Authorization', endUser.authorization),
          http()
            .get(`/api/v1/invitations?projectId=${project.id}`)
            .set('Authorization', developer.authorization),
        ]);

        expect(responses.map(({ status }) => status)).toEqual([403, 404, 404, 200]);
        expect(responses[3]?.body).toEqual({ items: [], nextCursor: null });
      });

      it('refuses a team invitation while GitHub sign-in is not configured', async () => {
        const withoutGithub = await startApp({ ...config, isGithubSignInConfigured: false });
        try {
          const { authorization } = await signIn();
          const project = await createProject(prisma);

          const [team, endUser] = await Promise.all([
            request(withoutGithub.getHttpServer())
              .post('/api/v1/invitations')
              .set('Authorization', authorization)
              .send({ email: newEmail(), target: { type: 'administrator' } }),
            request(withoutGithub.getHttpServer())
              .post('/api/v1/invitations')
              .set('Authorization', authorization)
              .send({
                email: newEmail(),
                target: projectTarget({ projectId: project.id }, 'end_user'),
              }),
          ]);

          expect([team.status, codeOf(team)]).toEqual([422, 'invitation.github_sign_in_missing']);
          expect(endUser.status).toBe(201);
        } finally {
          await withoutGithub.close();
        }
      });
    });

    describe('domain-based organization assignment', () => {
      async function organizationWithProject(state: 'active' | 'archived' = 'active') {
        const project = await createProject(prisma);
        const organization = await createOrganization(prisma, { state });
        const domain = buildOrganizationDomain();
        await prisma.organizationDomain.create({
          data: { organizationId: organization.id, domain },
        });
        await prisma.organizationProject.create({
          data: { organizationId: organization.id, projectId: project.id },
        });
        return { project, organization, domain };
      }

      it('names and stores the organization of the domain for an end user of its project', async () => {
        const { authorization } = await signIn();
        const { project, organization, domain } = await organizationWithProject();
        const email = newEmail(domain);
        const target = projectTarget({ projectId: project.id }, 'end_user');

        const previewed = await preview(authorization, email, target);
        const res = await invite(authorization, email, target);

        expect(previewed.body).toEqual({
          outcome: 'invite',
          organization: { id: organization.id, name: organization.name },
        });
        expect((res.body as { invitation: Invitation }).invitation.target).toMatchObject({
          organization: { id: organization.id, name: organization.name },
        });
      });

      it.each([
        ['another project', false, 'active'],
        ['an archived organization', true, 'archived'],
      ] as const)('matches no organization for %s', async (_case, sameProject, state) => {
        const { authorization } = await signIn();
        const { project, domain } = await organizationWithProject(state);
        const target = sameProject ? project : await createProject(prisma);

        const res = await preview(
          authorization,
          newEmail(domain),
          projectTarget({ projectId: target.id }, 'end_user'),
        );

        expect(res.body).toEqual({ outcome: 'invite', organization: null });
      });

      it('joins the organization on acceptance, or gives personal access once it is archived', async () => {
        const { project, organization, domain } = await organizationWithProject();
        const target = projectTarget({ projectId: project.id }, 'end_user');
        const joining = await issued(newEmail(domain), target);
        const personal = await issued(newEmail(domain), target);
        await prisma.organization.update({
          where: { id: organization.id },
          data: { state: 'archived' },
        });
        // Archiving through the API would revoke nothing here: the invitations target the project.

        expect((await acceptWithPassword(personal.token)).status).toBe(200);
        await prisma.organization.update({
          where: { id: organization.id },
          data: { state: 'active' },
        });
        expect((await acceptWithPassword(joining.token)).status).toBe(200);

        expect(
          await prisma.organizationMember.findUnique({
            where: { userId: joining.invitation.user.id },
          }),
        ).toMatchObject({ organizationId: organization.id });
        expect(
          await prisma.projectMember.count({ where: { userId: joining.invitation.user.id } }),
        ).toBe(0);
        expect(
          await prisma.projectMember.findMany({
            where: { userId: personal.invitation.user.id },
            select: { projectId: true, role: true },
          }),
        ).toEqual([{ projectId: project.id, role: 'end_user' }]);
      });
    });
  });

  describe('listing', () => {
    it('lists the pending invitations of a project, newest first, page by page, without links', async () => {
      const { authorization } = await signIn();
      const project = await createProject(prisma);
      const target = projectTarget({ projectId: project.id }, 'end_user');
      const first = await issued(newEmail(), target);
      const second = await issued(newEmail(), target);
      await issued(newEmail(), projectTarget({ projectId: (await createProject(prisma)).id }));

      const page1 = await http()
        .get(`/api/v1/invitations?projectId=${project.id}&limit=1`)
        .set('Authorization', authorization);
      const page2 = await http()
        .get(
          `/api/v1/invitations?projectId=${project.id}&limit=1&cursor=${(page1.body as InvitationPage).nextCursor}`,
        )
        .set('Authorization', authorization);

      expect(page1.status).toBe(200);
      expect((page1.body as InvitationPage).items.map(({ id }) => id)).toEqual([
        second.invitation.id,
      ]);
      expect(page2.body).toEqual({ items: [first.invitation], nextCursor: null });
      expect(JSON.stringify([page1.body, page2.body])).not.toMatch(/link|token/i);
    });

    it('filters by the derived state', async () => {
      const { user, authorization } = await signIn();
      const invited = await createUser(prisma, { kind: 'team', state: 'invited' });
      const now = Date.now();
      const [expired, revoked, accepted] = await Promise.all(
        [
          { expiresAt: new Date(now - DAY_MS) },
          { revokedAt: new Date(now) },
          { usedAt: new Date(now) },
        ].map((data) =>
          createInvitation(prisma, { userId: invited.id, invitedById: user.id, ...data }),
        ),
      );

      const states = await Promise.all(
        (['expired', 'revoked', 'accepted', 'pending'] as const).map(async (state) => {
          const res = await http()
            .get(`/api/v1/invitations?userId=${invited.id}&state=${state}`)
            .set('Authorization', authorization);
          return (res.body as InvitationPage).items.map(
            ({ id, state: itemState, allowedActions }) => ({
              id,
              state: itemState,
              allowedActions,
            }),
          );
        }),
      );

      expect(states).toEqual([
        [{ id: expired?.id, state: 'expired', allowedActions: ['resend'] }],
        [{ id: revoked?.id, state: 'revoked', allowedActions: [] }],
        [{ id: accepted?.id, state: 'accepted', allowedActions: [] }],
        [],
      ]);
    });

    it('shows a Project manager only the invitations of their projects', async () => {
      const [own, other] = await Promise.all([createProject(prisma), createProject(prisma)]);
      const ownInvitation = await issued(newEmail(), projectTarget({ projectId: own.id }));
      const otherInvitation = await issued(newEmail(), projectTarget({ projectId: other.id }));
      await issued(newEmail(), { type: 'administrator' });
      const { authorization } = await signIn('project_manager', own.id);

      const res = await http().get('/api/v1/invitations').set('Authorization', authorization);
      const resending = await http()
        .post(`/api/v1/invitations/${otherInvitation.invitation.id}/resending`)
        .set('Authorization', authorization);

      expect((res.body as InvitationPage).items.map(({ id }) => id)).toEqual([
        ownInvitation.invitation.id,
      ]);
      expect(resending.status).toBe(404);
    });
  });

  describe('resending and revoking', () => {
    it('replaces the token: the old link stops working, the new one is valid 7 days from now', async () => {
      const { user, authorization } = await signIn();
      const { invitation, token } = await issued(newEmail(), { type: 'administrator' });
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { expiresAt: new Date(Date.now() - DAY_MS) },
      });
      const before = Date.now();

      const res = await http()
        .post(`/api/v1/invitations/${invitation.id}/resending`)
        .set('Authorization', authorization);

      expect(res.status).toBe(200);
      const resent = res.body as ResentInvitation;
      expect(resent.invitation).toMatchObject({ id: invitation.id, state: 'pending' });
      expect(new Date(resent.invitation.expiresAt).getTime()).toBeGreaterThanOrEqual(
        before + 7 * DAY_MS,
      );
      expect((await verify(token)).body).toMatchObject({ code: 'invitation.token_invalid' });
      expect((await verify(tokenOf(resent.link))).status).toBe(200);
      expect(
        (await auditActions(invitation.id)).map(({ action, actorId }) => [action, actorId]),
      ).toEqual([
        ['invitation.issued', expect.any(String)],
        ['invitation.resent', user.id],
      ]);
    });

    it('revokes a pending invitation once', async () => {
      const { user, authorization } = await signIn();
      const { invitation, token } = await issued(newEmail(), { type: 'administrator' });
      const revoke = () =>
        http()
          .post(`/api/v1/invitations/${invitation.id}/revocation`)
          .set('Authorization', authorization);

      const first = await revoke();
      const second = await revoke();
      const resending = await http()
        .post(`/api/v1/invitations/${invitation.id}/resending`)
        .set('Authorization', authorization);

      expect(first.status).toBe(204);
      expect([second.status, codeOf(second)]).toEqual([409, 'invitation.not_pending']);
      expect([resending.status, codeOf(resending)]).toEqual([409, 'invitation.not_pending']);
      expect((await verify(token)).status).toBe(404);
      expect((await auditActions(invitation.id)).at(-1)).toEqual({
        action: 'invitation.revoked',
        actorId: user.id,
        details: { userId: invitation.user.id, reason: 'revoked' },
        ipAddress: null,
      });
    });

    it('refuses to resend an accepted invitation', async () => {
      const { authorization } = await signIn();
      const { invitation, token } = await issued(
        newEmail(),
        projectTarget({ projectId: (await createProject(prisma)).id }, 'end_user'),
      );
      await acceptWithPassword(token);

      const res = await http()
        .post(`/api/v1/invitations/${invitation.id}/resending`)
        .set('Authorization', authorization);

      expect([res.status, codeOf(res)]).toEqual([409, 'invitation.not_pending']);
    });

    it('revokes the pending invitations of a project or an organization when it is archived', async () => {
      const { authorization } = await signIn();
      const project = await createProject(prisma);
      const organization = await createOrganization(prisma);
      const toProject = await issued(newEmail(), projectTarget({ projectId: project.id }));
      const toOrganization = await issued(newEmail(), {
        type: 'organization',
        organizationId: organization.id,
      });

      const archived = await Promise.all([
        http()
          .put(`/api/v1/projects/${project.id}/archive`)
          .set('Authorization', authorization)
          .set('If-Match', `W/"${project.version}"`),
        http()
          .put(`/api/v1/organizations/${organization.id}/archive`)
          .set('Authorization', authorization)
          .set('If-Match', `W/"${organization.version}"`),
      ]);

      expect(archived.map(({ status }) => status)).toEqual([200, 200]);
      for (const [{ invitation, token }, reason] of [
        [toProject, 'project_archived'],
        [toOrganization, 'organization_archived'],
      ] as const) {
        expect((await verify(token)).status).toBe(404);
        expect((await auditActions(invitation.id)).at(-1)).toEqual({
          action: 'invitation.revoked',
          actorId: null,
          details: { userId: invitation.user.id, reason },
          ipAddress: null,
        });
      }
    });
  });

  describe('accepting', () => {
    it('shows the invited address, kind, target and inviter for a valid link', async () => {
      const project = await createProject(prisma);
      const email = newEmail();
      const { invitation, token } = await issued(
        email,
        projectTarget({ projectId: project.id }, 'end_user'),
      );

      const res = await verify(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        email: email.toLowerCase(),
        kind: 'end_user',
        accountState: 'invited',
        target: invitation.target,
        invitedBy: { displayName: invitation.invitedBy?.displayName },
        expiresAt: invitation.expiresAt,
      });
    });

    it.each([
      ['unknown', () => Promise.resolve(buildInvitationToken().token)],
      [
        'expired',
        async (userId: string) => {
          const { token, tokenHash } = buildInvitationToken();
          await createInvitation(prisma, {
            userId,
            tokenHash,
            expiresAt: new Date(Date.now() - 1_000),
          });
          return token;
        },
      ],
      [
        'revoked',
        async (userId: string) => {
          const { token, tokenHash } = buildInvitationToken();
          await createInvitation(prisma, { userId, tokenHash, revokedAt: new Date() });
          return token;
        },
      ],
      [
        'used',
        async (userId: string) => {
          const { token, tokenHash } = buildInvitationToken();
          await createInvitation(prisma, { userId, tokenHash, usedAt: new Date() });
          return token;
        },
      ],
    ])('rejects an %s link with invitation.token_invalid', async (_case, tokenFor) => {
      const account = await createUser(prisma, { kind: 'team', state: 'invited' });
      const token = await tokenFor(account.id);

      for (const res of [
        await verify(token),
        await acceptWithSession(token, randomUUID(), ['pwd', 'otp']),
      ]) {
        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ code: 'invitation.token_invalid' });
      }
    });

    describe('with a password', () => {
      it('creates the Keycloak user with the invited address and activates the account', async () => {
        const project = await createProject(prisma);
        const email = newEmail();
        const { invitation, token } = await issued(
          email,
          projectTarget({ projectId: project.id }, 'end_user'),
        );

        const res = await acceptWithPassword(token, { email: 'attacker@evil.example' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ kind: 'end_user', landingPath: `/projects/${project.id}` });
        const [keycloakUserId, keycloakUser] = [...keycloak.created][0] ?? [];
        expect(keycloakUser).toMatchObject({
          username: email.toLowerCase(),
          email: email.toLowerCase(),
          emailVerified: true,
          firstName: 'Anna',
          lastName: 'Nowak',
          attributes: { locale: ['pl'] },
          credentials: [{ type: 'password', value: PASSWORD, temporary: false }],
        });
        expect(keycloakUser).not.toHaveProperty('groups');
        expect(await prisma.user.findUnique({ where: { id: invitation.user.id } })).toMatchObject({
          keycloakUserId,
          state: 'active',
          displayName: 'Anna Nowak',
          language: 'pl',
          timeZone: 'Europe/Warsaw',
        });
        expect(
          await prisma.projectMember.findMany({
            where: { userId: invitation.user.id },
            select: { projectId: true, role: true },
          }),
        ).toEqual([{ projectId: project.id, role: 'end_user' }]);
        expect((await auditActions(invitation.id)).at(-1)).toEqual({
          action: 'invitation.accepted',
          actorId: invitation.user.id,
          details: { userId: invitation.user.id },
          ipAddress: '203.0.113.7',
        });
        expect((await acceptWithPassword(token)).body).toMatchObject({
          code: 'invitation.token_invalid',
        });
      });

      it('lands an organization invitation on the root and keeps no invalid time zone', async () => {
        const organization = await createOrganization(prisma);
        const { invitation, token } = await issued(newEmail(), {
          type: 'organization',
          organizationId: organization.id,
        });

        const res = await acceptWithPassword(token, { timeZone: 'Mars/Olympus', language: 'en' });

        expect(res.body).toEqual({ kind: 'end_user', landingPath: '/' });
        expect(await prisma.user.findUnique({ where: { id: invitation.user.id } })).toMatchObject({
          language: 'en',
          timeZone: null,
        });
        expect(
          await prisma.organizationMember.findUnique({ where: { userId: invitation.user.id } }),
        ).toMatchObject({ organizationId: organization.id });
      });

      it('deletes the Keycloak user again when the transaction fails', async () => {
        const { invitation, token } = await issued(newEmail(), {
          type: 'organization',
          organizationId: (await createOrganization(prisma)).id,
        });
        keycloak.afterCreate = async () => {
          await prisma.invitation.update({
            where: { id: invitation.id },
            data: { revokedAt: new Date() },
          });
        };

        const res = await acceptWithPassword(token);

        expect(res.body).toMatchObject({ code: 'invitation.token_invalid' });
        expect(keycloak.created.size).toBe(0);
        expect(keycloak.deleted).toHaveLength(1);
        expect(await prisma.user.findUnique({ where: { id: invitation.user.id } })).toMatchObject({
          state: 'invited',
          keycloakUserId: null,
        });
      });

      it('refuses a password for a team invitation and for a further link of an active account', async () => {
        const team = await issued(newEmail(), { type: 'administrator' });
        const project = await createProject(prisma);
        const email = newEmail();
        const first = await issued(email, projectTarget({ projectId: project.id }, 'end_user'));
        const further = await issued(email, {
          type: 'organization',
          organizationId: (await createOrganization(prisma)).id,
        });
        await acceptWithPassword(first.token);

        const teamRes = await acceptWithPassword(team.token);
        const furtherRes = await acceptWithPassword(further.token);

        expect(teamRes.status).toBe(422);
        expect(teamRes.body).toMatchObject({ errors: [{ pointer: '/method' }] });
        expect([furtherRes.status, codeOf(furtherRes)]).toEqual([
          403,
          'invitation.account_mismatch',
        ]);
      });
    });

    describe('with an identity provider', () => {
      it('binds a team member signed in with GitHub under another address and joins the group team', async () => {
        const project = await createProject(prisma);
        const email = newEmail();
        const { invitation, token } = await issued(email, projectTarget({ projectId: project.id }));
        const sub = keycloak.addUser(
          { email: 'octocat@users.noreply.github.com', firstName: 'Octo', lastName: 'Cat' },
          { github: 'octocat-' + randomUUID().slice(0, 8) },
        );

        const res = await acceptWithSession(token, sub);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ kind: 'team', landingPath: `/projects/${project.id}` });
        expect(keycloak.created.get(sub)).toMatchObject({
          email: email.toLowerCase(),
          emailVerified: true,
        });
        expect(keycloak.teamMembers).toEqual(new Set([sub]));
        expect(await prisma.user.findUnique({ where: { id: invitation.user.id } })).toMatchObject({
          keycloakUserId: sub,
          state: 'active',
          email: email.toLowerCase(),
          displayName: 'Octo Cat',
          githubLogin: keycloak.federatedIdentities.get(sub)?.github,
          language: 'en',
          timeZone: null,
        });
        expect(
          await prisma.projectMember.findMany({
            where: { userId: invitation.user.id },
            select: { role: true },
          }),
        ).toEqual([{ role: 'developer' }]);
      });

      it('refuses a team invitation accepted without GitHub', async () => {
        const { token } = await issued(newEmail(), { type: 'administrator' });
        const sub = keycloak.addUser({ email: 'x@example.com', firstName: 'X', lastName: 'Y' });

        const res = await acceptWithSession(token, sub);

        expect(res.status).toBe(422);
        expect(keycloak.teamMembers.size).toBe(0);
      });

      it('requires a valid access token', async () => {
        const { token } = await issued(newEmail(), { type: 'administrator' });

        const res = await http()
          .post('/api/v1/invitations/acceptance')
          .send({ method: 'identity_provider', token, language: 'en' });

        expect([res.status, codeOf(res)]).toEqual([401, 'authentication.required']);
      });

      it('refuses an address that another Keycloak user holds with invitation.email_taken', async () => {
        const email = newEmail();
        const { invitation, token } = await issued(email, {
          type: 'organization',
          organizationId: (await createOrganization(prisma)).id,
        });
        keycloak.addUser({ email: email.toLowerCase(), firstName: 'A', lastName: 'B' });
        const sub = keycloak.addUser({ email: 'other@example.com', firstName: 'C', lastName: 'D' });

        const res = await acceptWithSession(token, sub);

        expect([res.status, codeOf(res)]).toEqual([409, 'invitation.email_taken']);
        expect(await prisma.user.findUnique({ where: { id: invitation.user.id } })).toMatchObject({
          state: 'invited',
        });
      });
    });

    describe('further links of an active account', () => {
      it('grants only the target of the link used, and a further link only in that account’s session', async () => {
        const email = newEmail();
        const project = await createProject(prisma);
        const first = await issued(email, projectTarget({ projectId: project.id }));
        const administrator = await issued(email, { type: 'administrator' });
        const sub = keycloak.addUser(
          { email: 'gh@example.com', firstName: 'Gi', lastName: 'Hub' },
          { github: 'gh-' + randomUUID().slice(0, 8) },
        );

        expect((await acceptWithSession(first.token, sub)).status).toBe(200);
        const account = await prisma.user.findUniqueOrThrow({
          where: { id: first.invitation.user.id },
        });
        expect(account.isAdmin).toBe(false);
        expect((await verify(administrator.token)).body).toMatchObject({ accountState: 'active' });

        const someoneElse = await signIn('developer');
        const otherSession = await acceptWithSession(
          administrator.token,
          someoneElse.user.keycloakUserId ?? '',
          ['pwd', 'otp'],
        );
        const newSub = await acceptWithSession(administrator.token, randomUUID(), ['pwd', 'otp']);
        const withoutSecondFactor = await acceptWithSession(administrator.token, sub, ['pwd']);
        const ownSession = await acceptWithSession(administrator.token, sub, ['pwd', 'otp']);

        expect([otherSession.status, codeOf(otherSession)]).toEqual([
          403,
          'invitation.account_mismatch',
        ]);
        expect([newSub.status, codeOf(newSub)]).toEqual([403, 'invitation.account_mismatch']);
        expect([withoutSecondFactor.status, codeOf(withoutSecondFactor)]).toEqual([
          401,
          'authentication.second_factor_required',
        ]);
        expect(ownSession.status).toBe(200);
        expect(ownSession.body).toEqual({ kind: 'team', landingPath: '/' });
        expect(await prisma.user.findUnique({ where: { id: account.id } })).toMatchObject({
          isAdmin: true,
          keycloakUserId: sub,
        });
      });
    });
  });
});

interface Ids {
  projectId: string;
  organizationId: string;
}

async function targetIdsOf(prisma: PrismaService): Promise<Ids> {
  const [project, organization] = await Promise.all([
    createProject(prisma),
    createOrganization(prisma),
  ]);
  return { projectId: project.id, organizationId: organization.id };
}

function projectTarget(
  { projectId }: Pick<Ids, 'projectId'>,
  role: 'developer' | 'project_manager' | 'end_user' = 'developer',
): InvitationTarget {
  return { type: 'project', projectId, role };
}
