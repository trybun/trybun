import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  OrganizationMemberPage,
  OrganizationPage,
  Organization as OrganizationResponse,
} from '@trybun/contracts/organizations';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Organization } from '../../generated/prisma/client.js';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import {
  buildOrganizationDomain,
  createOrganization,
} from '../../../test/factories/organization.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
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
import { archivedProjectsRestriction, projectsAbilities } from '../projects/projects.abilities.js';
import {
  archivedOrganizationsRestriction,
  organizationsAbilities,
} from './organizations.abilities.js';
import { OrganizationsModule } from './organizations.module.js';
import { OrganizationsService } from './organizations.service.js';

type Who = 'admin' | 'team_member' | 'end_user';

describe('organizations endpoints', () => {
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
          rules: [projectsAbilities, organizationsAbilities],
          restrictions: [archivedProjectsRestriction, archivedOrganizationsRestriction],
        }),
        OrganizationsModule,
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

  const http = () => request(app.getHttpServer());

  /** A signed-in account; a team member signed in with 2FA (§7.4). */
  async function signIn(who: Who = 'admin') {
    const user = await createUser(prisma, {
      keycloakUserId: randomUUID(),
      kind: who === 'end_user' ? 'end_user' : 'team',
      isAdmin: who === 'admin',
    });
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: who === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
    });
    return { user, authorization: `Bearer ${token}` };
  }

  async function auditEntries(organizationId: string) {
    return prisma.auditLogEntry.findMany({
      where: { targetType: 'Organization', targetId: organizationId },
      select: { action: true, actorId: true, details: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  const ifMatch = (organization: { version: number }) => `W/"${organization.version}"`;

  async function organizationWithDomain(state: 'active' | 'archived' = 'active') {
    const organization = await createOrganization(prisma, { state });
    const domain = buildOrganizationDomain();
    await prisma.organizationDomain.create({ data: { organizationId: organization.id, domain } });
    return { organization, domain };
  }

  describe('creating', () => {
    it('creates an organization with its domains and audit entries', async () => {
      const { user, authorization } = await signIn();
      const domain = buildOrganizationDomain();
      const name = `Acme ${randomUUID()}`;

      const res = await http()
        .post('/api/v1/organizations')
        .set('Authorization', authorization)
        .send({ name: `  ${name}  `, domains: [domain.toUpperCase(), domain] });

      expect(res.status).toBe(201);
      const organization = res.body as OrganizationResponse;
      expect(organization).toMatchObject({
        name,
        state: 'active',
        domains: [domain],
        projects: [],
        memberCount: 0,
        version: 1,
      });
      expect(organization.allowedActions).toEqual([
        'read',
        'update',
        'archive',
        'unarchive',
        'delete',
        'manage_projects',
        'manage_members',
      ]);
      expect(await auditEntries(organization.id)).toEqual([
        { action: 'organization.created', actorId: user.id, details: null },
        { action: 'organization.domain_added', actorId: user.id, details: { domain } },
      ]);
    });

    it.each(['gmail.com', 'GMAIL.COM', 'Gmail.Com'])(
      'rejects the public mail domain %s with organization.domain_public at its field',
      async (domain) => {
        const { authorization } = await signIn();

        const res = await http()
          .post('/api/v1/organizations')
          .set('Authorization', authorization)
          .send({ name: `Acme ${randomUUID()}`, domains: [buildOrganizationDomain(), domain] });

        expect(res.status).toBe(422);
        expect(res.body).toMatchObject({
          code: 'organization.domain_public',
          errors: [{ pointer: '/domains/1', code: 'field.invalid' }],
        });
      },
    );

    it('rejects a domain that is not one with string.invalid_format', async () => {
      const { authorization } = await signIn();

      const res = await http()
        .post('/api/v1/organizations')
        .set('Authorization', authorization)
        .send({ name: `Acme ${randomUUID()}`, domains: ['*.company.com'] });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        code: 'request.validation_failed',
        errors: [{ pointer: '/domains/0', code: 'string.invalid_format' }],
      });
    });

    it.each(['active', 'archived'] as const)(
      'rejects a domain of an %s organization with organization.domain_taken',
      async (state) => {
        const { authorization } = await signIn();
        const { domain } = await organizationWithDomain(state);

        const res = await http()
          .post('/api/v1/organizations')
          .set('Authorization', authorization)
          .send({ name: `Acme ${randomUUID()}`, domains: [domain.toUpperCase()] });

        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({
          code: 'organization.domain_taken',
          errors: [{ pointer: '/domains/0', code: 'field.invalid' }],
        });
      },
    );

    it('rejects a name of another organization in any letter case', async () => {
      const { authorization } = await signIn();
      const existing = await createOrganization(prisma, { state: 'archived' });

      const res = await http()
        .post('/api/v1/organizations')
        .set('Authorization', authorization)
        .send({ name: existing.name.toUpperCase() });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        code: 'organization.name_taken',
        errors: [{ pointer: '/name', code: 'field.invalid' }],
      });
    });

    it('gives one domain to only one of two concurrent organizations', async () => {
      const { authorization } = await signIn();
      const domain = buildOrganizationDomain();

      const responses = await Promise.all(
        [1, 2].map(() =>
          http()
            .post('/api/v1/organizations')
            .set('Authorization', authorization)
            .send({ name: `Acme ${randomUUID()}`, domains: [domain] }),
        ),
      );

      expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
      expect(responses.find((res) => res.status === 409)?.body).toMatchObject({
        code: 'organization.domain_taken',
      });
    });

    it('gives one name to only one of two concurrent organizations', async () => {
      const { authorization } = await signIn();
      const name = `Acme ${randomUUID()}`;

      const responses = await Promise.all(
        [name, name.toUpperCase()].map((each) =>
          http().post('/api/v1/organizations').set('Authorization', authorization).send({
            name: each,
          }),
        ),
      );

      expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
      expect(responses.find((res) => res.status === 409)?.body).toMatchObject({
        code: 'organization.name_taken',
      });
    });
  });

  describe('visibility', () => {
    it.each(['team_member', 'end_user'] as const)(
      'answers every endpoint with 404 for a %s',
      async (who) => {
        const { authorization } = await signIn(who);
        const organization = await createOrganization(prisma);
        const path = `/api/v1/organizations/${organization.id}`;

        const responses = await Promise.all([
          http().get('/api/v1/organizations').set('Authorization', authorization),
          http()
            .post('/api/v1/organizations')
            .set('Authorization', authorization)
            .send({ name: 'Acme' }),
          http().get(path).set('Authorization', authorization),
          http()
            .patch(path)
            .set('Authorization', authorization)
            .set('If-Match', ifMatch(organization))
            .send({ name: 'Acme' }),
          http()
            .put(`${path}/archive`)
            .set('Authorization', authorization)
            .set('If-Match', ifMatch(organization)),
          http()
            .delete(`${path}/archive`)
            .set('Authorization', authorization)
            .set('If-Match', ifMatch(organization)),
          http()
            .delete(path)
            .set('Authorization', authorization)
            .set('If-Match', ifMatch(organization)),
          http().get(`${path}/members`).set('Authorization', authorization),
          http()
            .post(`${path}/members`)
            .set('Authorization', authorization)
            .send({ email: 'anna@acme.example' }),
          http().delete(`${path}/members/${randomUUID()}`).set('Authorization', authorization),
        ]);

        expect(responses.map((res) => res.status)).toEqual(Array(10).fill(404));
      },
    );
  });

  describe('reading', () => {
    it('lists the organizations with access to a project, in one state, page by page', async () => {
      const { authorization } = await signIn();
      const project = await createProject(prisma);
      const [bravo, alpha, archived] = await Promise.all(
        [
          { name: `Bravo ${randomUUID()}` },
          { name: `Alpha ${randomUUID()}` },
          { name: `Archived ${randomUUID()}`, state: 'archived' as const },
        ].map((data) => createOrganization(prisma, data)),
      );
      for (const organization of [bravo, alpha, archived] as Organization[]) {
        await prisma.organizationProject.create({
          data: { organizationId: organization.id, projectId: project.id },
        });
      }

      const first = await http()
        .get(`/api/v1/organizations?projectId=${project.id}&limit=1`)
        .set('Authorization', authorization);
      const second = await http()
        .get(
          `/api/v1/organizations?projectId=${project.id}&limit=1&cursor=${String((first.body as OrganizationPage).nextCursor)}`,
        )
        .set('Authorization', authorization);
      const archivedPage = await http()
        .get(`/api/v1/organizations?projectId=${project.id}&state=archived`)
        .set('Authorization', authorization);

      expect(first.body).toMatchObject({ items: [{ id: alpha?.id, memberCount: 0 }] });
      expect(second.body).toMatchObject({ items: [{ id: bravo?.id }], nextCursor: null });
      expect(archivedPage.body).toMatchObject({
        items: [{ id: archived?.id, allowedActions: ['read', 'unarchive', 'delete'] }],
      });
    });

    it('returns an organization with its domains, projects and weak ETag', async () => {
      const { authorization } = await signIn();
      const { organization, domain } = await organizationWithDomain();
      const project = await createProject(prisma);
      await prisma.organizationProject.create({
        data: { organizationId: organization.id, projectId: project.id },
      });

      const res = await http()
        .get(`/api/v1/organizations/${organization.id}`)
        .set('Authorization', authorization);

      expect(res.status).toBe(200);
      expect(res.headers.etag).toBe('W/"1"');
      expect(res.body).toMatchObject({
        id: organization.id,
        domains: [domain],
        projects: [{ id: project.id, key: project.key, name: project.name, state: 'active' }],
      });
    });
  });

  describe('changing', () => {
    it('renames and replaces the domains with an audit entry per change', async () => {
      const { user, authorization } = await signIn();
      const { organization, domain } = await organizationWithDomain();
      const added = buildOrganizationDomain();
      const name = `Renamed ${randomUUID()}`;

      const res = await http()
        .patch(`/api/v1/organizations/${organization.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(organization))
        .send({ name, domains: [added] });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name, domains: [added], version: 2 });
      expect(await auditEntries(organization.id)).toEqual([
        { action: 'organization.renamed', actorId: user.id, details: null },
        { action: 'organization.domain_removed', actorId: user.id, details: { domain } },
        { action: 'organization.domain_added', actorId: user.id, details: { domain: added } },
      ]);
    });

    it('keeps its own domains and its own name in another letter case', async () => {
      const { authorization } = await signIn();
      const { organization, domain } = await organizationWithDomain();

      const res = await http()
        .patch(`/api/v1/organizations/${organization.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(organization))
        .send({ name: organization.name.toUpperCase(), domains: [domain] });

      expect(res.status).toBe(200);
      expect(await auditEntries(organization.id)).toEqual([
        expect.objectContaining({ action: 'organization.renamed' }),
      ]);
    });

    it('rejects a domain of another organization with organization.domain_taken', async () => {
      const { authorization } = await signIn();
      const organization = await createOrganization(prisma);
      const other = await organizationWithDomain();

      const res = await http()
        .patch(`/api/v1/organizations/${organization.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(organization))
        .send({ domains: [buildOrganizationDomain(), other.domain] });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        code: 'organization.domain_taken',
        errors: [{ pointer: '/domains/1', code: 'field.invalid' }],
      });
    });

    it('rejects gmail.com with organization.domain_public', async () => {
      const { authorization } = await signIn();
      const organization = await createOrganization(prisma);

      const res = await http()
        .patch(`/api/v1/organizations/${organization.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(organization))
        .send({ domains: ['gmail.com'] });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'organization.domain_public' });
    });

    it('rejects a stale version with 412 and a missing one with 428', async () => {
      const { authorization } = await signIn();
      const organization = await createOrganization(prisma, { version: 3 });

      const stale = await http()
        .patch(`/api/v1/organizations/${organization.id}`)
        .set('Authorization', authorization)
        .set('If-Match', 'W/"2"')
        .send({ name: `Acme ${randomUUID()}` });
      const missing = await http()
        .patch(`/api/v1/organizations/${organization.id}`)
        .set('Authorization', authorization)
        .send({ name: `Acme ${randomUUID()}` });

      expect(stale.status).toBe(412);
      expect(missing.status).toBe(428);
    });

    it('grants and removes the access to projects with audit entries', async () => {
      const { user, authorization } = await signIn();
      const organization = await createOrganization(prisma);
      const [first, second] = await Promise.all([createProject(prisma), createProject(prisma)]);
      await prisma.organizationProject.create({
        data: { organizationId: organization.id, projectId: first.id },
      });

      const res = await http()
        .patch(`/api/v1/organizations/${organization.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(organization))
        .send({ projectIds: [second.id] });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ projects: [{ id: second.id }], version: 2 });
      expect(await auditEntries(organization.id)).toEqual([
        {
          action: 'organization.project_removed',
          actorId: user.id,
          details: { projectId: first.id },
        },
        {
          action: 'organization.project_added',
          actorId: user.id,
          details: { projectId: second.id },
        },
      ]);
    });

    it('answers an unknown project with 404', async () => {
      const { authorization } = await signIn();
      const organization = await createOrganization(prisma);

      const res = await http()
        .patch(`/api/v1/organizations/${organization.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(organization))
        .send({ projectIds: [randomUUID()] });

      expect(res.status).toBe(404);
    });

    it('rejects granting and removing the access to an archived project', async () => {
      const { authorization } = await signIn();
      const organization = await createOrganization(prisma);
      const other = await createOrganization(prisma);
      const archived = await createProject(prisma, { state: 'archived' });
      await prisma.organizationProject.create({
        data: { organizationId: other.id, projectId: archived.id },
      });

      const granting = await http()
        .patch(`/api/v1/organizations/${organization.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(organization))
        .send({ projectIds: [archived.id] });
      const removing = await http()
        .patch(`/api/v1/organizations/${other.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(other))
        .send({ projectIds: [] });

      expect(granting.status).toBe(409);
      expect(granting.body).toMatchObject({ code: 'project.archived' });
      expect(removing.status).toBe(409);
    });
  });

  describe('archiving, unarchiving and deleting', () => {
    it('archives and unarchives an organization with audit entries', async () => {
      const { user, authorization } = await signIn();
      const organization = await createOrganization(prisma);

      const archived = await http()
        .put(`/api/v1/organizations/${organization.id}/archive`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(organization));
      const unarchived = await http()
        .delete(`/api/v1/organizations/${organization.id}/archive`)
        .set('Authorization', authorization)
        .set('If-Match', 'W/"2"');

      expect(archived.status).toBe(200);
      expect(archived.body).toMatchObject({
        state: 'archived',
        version: 2,
        allowedActions: ['read', 'unarchive', 'delete'],
      });
      expect(unarchived.status).toBe(204);
      expect(await auditEntries(organization.id)).toEqual([
        { action: 'organization.archived', actorId: user.id, details: null },
        { action: 'organization.unarchived', actorId: user.id, details: null },
      ]);
    });

    it('rejects every change of an archived organization with organization.archived', async () => {
      const { authorization } = await signIn();
      const organization = await createOrganization(prisma, { state: 'archived' });
      const member = await createUser(prisma);
      await prisma.organizationMember.create({
        data: { organizationId: organization.id, userId: member.id },
      });
      const path = `/api/v1/organizations/${organization.id}`;

      const responses = await Promise.all([
        http()
          .patch(path)
          .set('Authorization', authorization)
          .set('If-Match', ifMatch(organization))
          .send({ name: `Acme ${randomUUID()}` }),
        http()
          .patch(path)
          .set('Authorization', authorization)
          .set('If-Match', ifMatch(organization))
          .send({ projectIds: [] }),
        http()
          .put(`${path}/archive`)
          .set('Authorization', authorization)
          .set('If-Match', ifMatch(organization)),
        http()
          .post(`${path}/members`)
          .set('Authorization', authorization)
          .send({ email: (await createUser(prisma)).email }),
        http().delete(`${path}/members/${member.id}`).set('Authorization', authorization),
      ]);

      expect(responses.map((res) => res.status)).toEqual(Array(5).fill(409));
      expect(responses.map((res) => (res.body as { code: string }).code)).toEqual(
        Array(5).fill('organization.archived'),
      );
    });

    it('records the removal of a member added while the organization is deleted', async () => {
      const { authorization } = await signIn();
      const organization = await createOrganization(prisma);
      const members = await Promise.all([1, 2, 3].map(() => createUser(prisma)));

      await Promise.all([
        ...members.map((member) =>
          http()
            .post(`/api/v1/organizations/${organization.id}/members`)
            .set('Authorization', authorization)
            .send({ email: member.email }),
        ),
        http()
          .delete(`/api/v1/organizations/${organization.id}`)
          .set('Authorization', authorization)
          .set('If-Match', ifMatch(organization)),
      ]);

      const entries = await auditEntries(organization.id);
      const added = entries.filter(({ action }) => action === 'organization.member_added');
      const removed = entries.filter(({ action }) => action === 'organization.member_removed');
      expect(entries.at(-1)).toMatchObject({ action: 'organization.deleted' });
      expect(removed.map(({ details }) => details)).toEqual(
        expect.arrayContaining(added.map(({ details }) => details)),
      );
      expect(removed).toHaveLength(added.length);
    });

    it('deletes an organization with its domains, access and members', async () => {
      const { user, authorization } = await signIn();
      const { organization, domain } = await organizationWithDomain('archived');
      const project = await createProject(prisma);
      const member = await createUser(prisma);
      await prisma.organizationProject.create({
        data: { organizationId: organization.id, projectId: project.id },
      });
      await prisma.organizationMember.create({
        data: { organizationId: organization.id, userId: member.id },
      });

      const res = await http()
        .delete(`/api/v1/organizations/${organization.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(organization));

      expect(res.status).toBe(204);
      expect(await prisma.organizationDomain.count({ where: { domain } })).toBe(0);
      expect(await prisma.organizationMember.count({ where: { userId: member.id } })).toBe(0);
      expect(await prisma.user.count({ where: { id: member.id } })).toBe(1);
      expect(await auditEntries(organization.id)).toEqual([
        {
          action: 'organization.member_removed',
          actorId: user.id,
          details: { userId: member.id },
        },
        { action: 'organization.deleted', actorId: user.id, details: null },
      ]);
    });
  });

  describe('members', () => {
    it('adds an end user by e-mail address in any letter case, once', async () => {
      const { user, authorization } = await signIn();
      const organization = await createOrganization(prisma);
      const member = await createUser(prisma, { state: 'invited' });
      const path = `/api/v1/organizations/${organization.id}/members`;

      const added = await http()
        .post(path)
        .set('Authorization', authorization)
        .send({ email: (member.email ?? '').toUpperCase() });
      const again = await http()
        .post(path)
        .set('Authorization', authorization)
        .send({ email: member.email });
      const list = await http().get(path).set('Authorization', authorization);
      const detail = await http()
        .get(`/api/v1/organizations/${organization.id}`)
        .set('Authorization', authorization);

      expect(added.status).toBe(201);
      expect(added.body).toMatchObject({
        user: { id: member.id, email: member.email, state: 'invited' },
      });
      expect(again.status).toBe(200);
      expect((list.body as OrganizationMemberPage).items).toEqual([added.body]);
      expect(detail.body).toMatchObject({ memberCount: 1, version: 1 });
      expect(await auditEntries(organization.id)).toEqual([
        {
          action: 'organization.member_added',
          actorId: user.id,
          details: { userId: member.id },
        },
      ]);
    });

    it('rejects an unknown address and a team account at the field', async () => {
      const { authorization } = await signIn();
      const organization = await createOrganization(prisma);
      const team = await createUser(prisma, { kind: 'team' });
      const path = `/api/v1/organizations/${organization.id}/members`;

      const unknown = await http()
        .post(path)
        .set('Authorization', authorization)
        .send({ email: `${randomUUID()}@acme.example` });
      const teamAccount = await http()
        .post(path)
        .set('Authorization', authorization)
        .send({ email: team.email });

      expect(unknown.status).toBe(422);
      expect(unknown.body).toMatchObject({
        code: 'organization.member_not_found',
        errors: [{ pointer: '/email', code: 'field.invalid' }],
      });
      expect(teamAccount.status).toBe(422);
      expect(teamAccount.body).toMatchObject({ code: 'organization.member_not_end_user' });
    });

    it('moves a member of another organization only with the confirmation', async () => {
      const { user, authorization } = await signIn();
      const [from, to] = await Promise.all([
        createOrganization(prisma),
        createOrganization(prisma),
      ]);
      const member = await createUser(prisma);
      await prisma.organizationMember.create({
        data: { organizationId: from.id, userId: member.id },
      });
      const path = `/api/v1/organizations/${to.id}/members`;

      const unconfirmed = await http()
        .post(path)
        .set('Authorization', authorization)
        .send({ email: member.email });
      const moved = await http()
        .post(path)
        .set('Authorization', authorization)
        .send({ email: member.email, move: true });

      expect(unconfirmed.status).toBe(409);
      expect(unconfirmed.body).toMatchObject({
        code: 'organization.member_of_other_organization',
      });
      expect(moved.status).toBe(201);
      expect(await prisma.organizationMember.findUnique({ where: { userId: member.id } })).toEqual(
        expect.objectContaining({ organizationId: to.id }),
      );
      expect(await auditEntries(from.id)).toEqual([
        {
          action: 'organization.member_removed',
          actorId: user.id,
          details: { userId: member.id },
        },
      ]);
      expect(await auditEntries(to.id)).toEqual([
        {
          action: 'organization.member_added',
          actorId: user.id,
          details: { userId: member.id },
        },
      ]);
    });

    it('does not move a member out of an archived organization', async () => {
      const { authorization } = await signIn();
      const from = await createOrganization(prisma, { state: 'archived' });
      const to = await createOrganization(prisma);
      const member = await createUser(prisma);
      await prisma.organizationMember.create({
        data: { organizationId: from.id, userId: member.id },
      });

      const res = await http()
        .post(`/api/v1/organizations/${to.id}/members`)
        .set('Authorization', authorization)
        .send({ email: member.email, move: true });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'organization.archived' });
    });

    it('adds one person to only one of two organizations at once', async () => {
      const { authorization } = await signIn();
      const organizations = await Promise.all([
        createOrganization(prisma),
        createOrganization(prisma),
      ]);
      const member = await createUser(prisma);

      const responses = await Promise.all(
        organizations.map((organization) =>
          http()
            .post(`/api/v1/organizations/${organization.id}/members`)
            .set('Authorization', authorization)
            .send({ email: member.email }),
        ),
      );

      expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
      expect(responses.find((res) => res.status === 409)?.body).toMatchObject({
        code: 'organization.member_of_other_organization',
      });
    });

    it('removes a member once when two removals run at once', async () => {
      const { authorization } = await signIn();
      const organization = await createOrganization(prisma);
      const member = await createUser(prisma);
      await prisma.organizationMember.create({
        data: { organizationId: organization.id, userId: member.id },
      });

      const responses = await Promise.all(
        [1, 2].map(() =>
          http()
            .delete(`/api/v1/organizations/${organization.id}/members/${member.id}`)
            .set('Authorization', authorization),
        ),
      );

      expect(responses.map((res) => res.status).sort()).toEqual([204, 404]);
      expect(await auditEntries(organization.id)).toHaveLength(1);
    });

    it('removes a member with an audit entry and answers a non-member with 404', async () => {
      const { user, authorization } = await signIn();
      const organization = await createOrganization(prisma);
      const member = await createUser(prisma);
      await prisma.organizationMember.create({
        data: { organizationId: organization.id, userId: member.id },
      });
      const path = `/api/v1/organizations/${organization.id}/members/${member.id}`;

      const removed = await http().delete(path).set('Authorization', authorization);
      const again = await http().delete(path).set('Authorization', authorization);

      expect(removed.status).toBe(204);
      expect(again.status).toBe(404);
      expect(await auditEntries(organization.id)).toEqual([
        {
          action: 'organization.member_removed',
          actorId: user.id,
          details: { userId: member.id },
        },
      ]);
    });
  });

  describe('the service for other modules', () => {
    it('removes a membership after an account change also in an archived organization', async () => {
      const { user } = await signIn();
      const organization = await createOrganization(prisma, { state: 'archived' });
      const member = await createUser(prisma);
      await prisma.organizationMember.create({
        data: { organizationId: organization.id, userId: member.id },
      });
      const principal: UserPrincipal = {
        kind: 'user',
        userId: user.id,
        userKind: 'team',
        isAdmin: true,
      };

      await prisma.$transaction((tx) =>
        app.get(OrganizationsService).removeMembership(tx, principal, member.id),
      );

      expect(await prisma.organizationMember.count({ where: { userId: member.id } })).toBe(0);
      expect(await auditEntries(organization.id)).toEqual([
        {
          action: 'organization.member_removed',
          actorId: user.id,
          details: { userId: member.id },
        },
      ]);
    });

    it('finds the organization of an invitation by its exact domain and project', async () => {
      const service = app.get(OrganizationsService);
      const { organization, domain } = await organizationWithDomain();
      const archived = await organizationWithDomain('archived');
      const [project, other] = await Promise.all([createProject(prisma), createProject(prisma)]);
      for (const organizationId of [organization.id, archived.organization.id]) {
        await prisma.organizationProject.create({
          data: { organizationId, projectId: project.id },
        });
      }
      const find = (email: string, projectId: string) =>
        prisma.$transaction((tx) => service.findForInvitation(tx, email, projectId));

      expect(await find(`anna@${domain.toUpperCase()}`, project.id)).toEqual({
        id: organization.id,
        name: organization.name,
      });
      expect(await find(`anna@pl.${domain}`, project.id)).toBeNull();
      expect(await find(`anna@${domain}`, other.id)).toBeNull();
      expect(await find(`anna@${archived.domain}`, project.id)).toBeNull();
    });
  });
});
