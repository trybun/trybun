// The permission layer end to end (§7.5, §14.4, §18.3, §18.7): the access of every principal
// fixture to real records, lists that equal details, the actions of the project response and the
// denied case of every endpoint.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { accessibleBy } from '@casl/prisma/runtime';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Project, type ProjectPage, projectActionSchema } from '@trybun/contracts/projects';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { keycloakJwksHandler, signAccessToken } from '../test/factories/access-token.factory.js';
import { createInvitation } from '../test/factories/invitation.factory.js';
import { createOrganization } from '../test/factories/organization.factory.js';
import { PRINCIPAL_FIXTURES, type PrincipalFixture } from '../test/factories/principal.factory.js';
import { createProjectMember } from '../test/factories/project-member.factory.js';
import { buildProjectKey, createProject } from '../test/factories/project.factory.js';
import { createUser } from '../test/factories/user.factory.js';
import { mswServer } from '../test/msw/server.js';
import { integrationConfig } from '../test/setup/config.js';
import { ABILITY_DEFINITIONS } from './ability-definitions.js';
import { ApiModule } from './api.module.js';
import type { User } from './generated/prisma/client.js';
import type { UserPrincipal } from './platform/authentication/principal.js';
import { AbilityFactory, type AppAbility } from './platform/authorization/ability-factory.js';
import type { RecordSubject } from './platform/authorization/record-descriptor.js';
import { PrismaService } from './platform/database/prisma.service.js';
import { API_PREFIX } from './platform/http/api-prefix.js';

describe('permission layer', () => {
  const config = integrationConfig();
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  const abilities = new AbilityFactory(ABILITY_DEFINITIONS.rules, ABILITY_DEFINITIONS.restrictions);

  /** The records of this test: an active project A, a project B and an archived project. */
  const records = {} as {
    projectA: { id: string };
    projectB: { id: string };
    archivedProject: { id: string };
    organization: { id: string };
    archivedOrganization: { id: string };
    projectInvitation: { id: string };
    organizationInvitation: { id: string };
  };
  const users = {} as Record<PrincipalFixture, User>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiModule.forRoot(config)],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
    prisma = app.get(PrismaService);

    records.projectA = await createProject(prisma);
    records.projectB = await createProject(prisma);
    records.archivedProject = await createProject(prisma, { state: 'archived' });
    records.organization = await createOrganization(prisma);
    records.archivedOrganization = await createOrganization(prisma, { state: 'archived' });
    // The active organization has project A and the archived project; the archived one project B.
    await prisma.organizationProject.createMany({
      data: [
        { organizationId: records.organization.id, projectId: records.projectA.id },
        { organizationId: records.organization.id, projectId: records.archivedProject.id },
        { organizationId: records.archivedOrganization.id, projectId: records.projectB.id },
      ],
    });
    for (const fixture of PRINCIPAL_FIXTURES) {
      users[fixture] = await createUser(prisma, {
        keycloakUserId: randomUUID(),
        kind: fixture.startsWith('end_user') ? 'end_user' : 'team',
        isAdmin: fixture === 'admin',
      });
    }
    // The fixtures relate to project A and the archived project as their names say.
    for (const projectId of [records.projectA.id, records.archivedProject.id]) {
      await createProjectMember(prisma, {
        projectId,
        userId: users.project_manager.id,
        role: 'project_manager',
      });
      await createProjectMember(prisma, {
        projectId,
        userId: users.developer.id,
        role: 'developer',
      });
      await createProjectMember(prisma, {
        projectId,
        userId: users.end_user_personal.id,
        role: 'end_user',
      });
    }
    await prisma.organizationMember.createMany({
      data: [
        { userId: users.end_user_organization.id, organizationId: records.organization.id },
        {
          userId: users.end_user_archived_organization.id,
          organizationId: records.archivedOrganization.id,
        },
      ],
    });
    const invitee = await createUser(prisma, { state: 'invited' });
    records.projectInvitation = await createInvitation(prisma, {
      userId: invitee.id,
      target: 'project',
      projectId: records.projectA.id,
      role: 'end_user',
    });
    records.organizationInvitation = await createInvitation(prisma, {
      userId: invitee.id,
      target: 'organization',
      organizationId: records.organization.id,
    });
  });

  beforeEach(() => {
    mswServer.use(keycloakJwksHandler(config));
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  function principalOf(fixture: PrincipalFixture): UserPrincipal {
    const user = users[fixture];
    return { kind: 'user', userId: user.id, userKind: user.kind, isAdmin: user.isAdmin };
  }

  /** A signed-in fixture; team accounts with 2FA (§7.4). */
  async function authorizationOf(fixture: PrincipalFixture): Promise<string> {
    const token = await signAccessToken(config, {
      sub: users[fixture].keycloakUserId ?? '',
      amr: fixture.startsWith('end_user') ? ['pwd'] : ['pwd', 'otp'],
    });
    return `Bearer ${token}`;
  }

  describe("end users' access to projects (§7.1, §7.3)", () => {
    it.each([
      ['end_user_personal', 'active', ['projectA']],
      ['end_user_personal', 'archived', ['archivedProject']],
      ['end_user_organization', 'active', ['projectA']],
      ['end_user_organization', 'archived', ['archivedProject']],
      ['end_user_archived_organization', 'active', []],
      ['end_user', 'active', []],
    ] as const)('lists for %s the %s projects %o', async (fixture, state, expected) => {
      const res = await http()
        .get('/api/v1/projects')
        .query({ state, limit: 100 })
        .set('Authorization', await authorizationOf(fixture));

      expect(res.status).toBe(200);
      const ids = (res.body as ProjectPage).items.map(({ id }) => id);
      expect(ids.filter((id) => Object.values(records).some((r) => r.id === id))).toEqual(
        expected.map((name) => records[name].id),
      );
      for (const project of (res.body as ProjectPage).items) {
        expect(project.role).toBe('end_user');
      }
    });

    it.each(['end_user_personal', 'end_user_organization'] as const)(
      'shows project A to %s with the role end_user',
      async (fixture) => {
        const res = await http()
          .get(`/api/v1/projects/${records.projectA.id}`)
          .set('Authorization', await authorizationOf(fixture));

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ role: 'end_user', allowedActions: ['read'] });
      },
    );

    it('gives a team account no role from data that contradicts its kind (§7.1)', async () => {
      const user = await createUser(prisma, {
        keycloakUserId: randomUUID(),
        kind: 'team',
        isAdmin: true,
      });
      await prisma.organizationMember.create({
        data: { userId: user.id, organizationId: records.organization.id },
      });
      await createProjectMember(prisma, {
        projectId: records.projectA.id,
        userId: user.id,
        role: 'end_user',
      });
      const token = await signAccessToken(config, {
        sub: user.keycloakUserId ?? '',
        amr: ['pwd', 'otp'],
      });

      const res = await http()
        .get(`/api/v1/projects/${records.projectA.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ role: null, allowedActions: projectActionSchema.options });
    });

    it('hides the projects of an archived organization (404)', async () => {
      const res = await http()
        .get(`/api/v1/projects/${records.projectB.id}`)
        .set('Authorization', await authorizationOf('end_user_archived_organization'));

      expect(res.status).toBe(404);
    });
  });

  describe('lists equal details (§14.4)', () => {
    /** The records of a subject the list filter returns, among the records of this test. */
    function listed(subject: RecordSubject, ability: AppAbility, ids: string[]) {
      const where = { id: { in: ids } };
      const select = { id: true };
      switch (subject) {
        case 'Project':
          return prisma.project.findMany({
            where: { AND: [accessibleBy(ability, 'read').ofType('Project'), where] },
            select,
          });
        case 'Organization':
          return prisma.organization.findMany({
            where: { AND: [accessibleBy(ability, 'read').ofType('Organization'), where] },
            select,
          });
        case 'Invitation':
          return prisma.invitation.findMany({
            where: { AND: [accessibleBy(ability, 'read').ofType('Invitation'), where] },
            select,
          });
        case 'User':
          return prisma.user.findMany({
            where: { AND: [accessibleBy(ability, 'read').ofType('User'), where] },
            select,
          });
      }
    }

    it.each(PRINCIPAL_FIXTURES)(
      'returns for %s exactly the records its detail check allows',
      async (fixture) => {
        const principal = principalOf(fixture);
        const ability = abilities.forPrincipal(principal);
        const ids: Record<RecordSubject, string[]> = {
          Project: [records.projectA.id, records.projectB.id, records.archivedProject.id],
          Organization: [records.organization.id, records.archivedOrganization.id],
          Invitation: [records.projectInvitation.id, records.organizationInvitation.id],
          User: Object.values(users).map(({ id }) => id),
        };

        for (const descriptor of ABILITY_DEFINITIONS.records) {
          const detailed: string[] = [];
          for (const id of ids[descriptor.subject]) {
            const record = await descriptor.find(prisma, { id }, principal);
            if (record !== null && ability.can('read', record)) {
              detailed.push(id);
            }
          }
          const list = await listed(descriptor.subject, ability, ids[descriptor.subject]);

          expect(list.map(({ id }) => id).sort(), descriptor.subject).toEqual(detailed.sort());
        }
      },
    );
  });

  describe('the actions of the project response (§18.3)', () => {
    it.each([
      ['admin', 'projectA', projectActionSchema.options],
      ['admin', 'archivedProject', ['read', 'unarchive', 'read_members']],
      [
        'project_manager',
        'projectA',
        ['read', 'update_settings', 'read_members', 'manage_members'],
      ],
      ['project_manager', 'archivedProject', ['read', 'read_members']],
      ['developer', 'projectA', ['read', 'read_members']],
      ['developer', 'archivedProject', ['read', 'read_members']],
      ['end_user_personal', 'archivedProject', ['read']],
      ['end_user_organization', 'archivedProject', ['read']],
    ] as const)('lists for %s on %s exactly %o', async (fixture, project, actions) => {
      const res = await http()
        .get(`/api/v1/projects/${records[project].id}`)
        .set('Authorization', await authorizationOf(fixture));

      expect(res.status).toBe(200);
      expect((res.body as Project).allowedActions).toEqual(actions);
    });

    it.each(['team_member', 'end_user_archived_organization', 'end_user'] as const)(
      'hides project A from %s (404)',
      async (fixture) => {
        const res = await http()
          .get(`/api/v1/projects/${records.projectA.id}`)
          .set('Authorization', await authorizationOf(fixture));

        expect(res.status).toBe(404);
      },
    );
  });

  describe('the denied case of every endpoint', () => {
    const someone = () => users.end_user.id;
    const newProject = () => ({ name: 'ERP', key: buildProjectKey() });
    const invitationTo = (projectId: string) => ({
      email: `${randomUUID()}@example.com`,
      target: { type: 'project', projectId, role: 'end_user' },
    });

    /** Requests of a Developer of project A: `404` for project B, as for an ID that does not exist. */
    it.each([
      ['GET', (id: string) => `/api/v1/projects/${id}`],
      ['PATCH', (id: string) => `/api/v1/projects/${id}`],
      ['PUT', (id: string) => `/api/v1/projects/${id}/archive`],
      ['DELETE', (id: string) => `/api/v1/projects/${id}/archive`],
      ['DELETE', (id: string) => `/api/v1/projects/${id}`],
      ['GET', (id: string) => `/api/v1/projects/${id}/members`],
      ['POST', (id: string) => `/api/v1/projects/${id}/members`],
      ['PATCH', (id: string) => `/api/v1/projects/${id}/members/${someone()}`],
      ['DELETE', (id: string) => `/api/v1/projects/${id}/members/${someone()}`],
      ['GET', (id: string) => `/api/v1/projects/${id}/member-candidates`],
    ] as const)(
      'answers %s %s of project B with 404, as for a missing project',
      async (method, path) => {
        const authorization = await authorizationOf('developer');
        const send = (id: string) =>
          http()
            [method.toLowerCase() as 'get'](path(id))
            .set('Authorization', authorization)
            .set('If-Match', 'W/"1"')
            .send(method === 'GET' || method === 'DELETE' ? undefined : {});

        const invisible = await send(records.projectB.id);
        const missing = await send(randomUUID());

        expect(invisible.status).toBe(404);
        expect({ ...invisible.body, instance: undefined }).toEqual({
          ...missing.body,
          instance: undefined,
        });
      },
    );

    it.each([
      [
        'a Developer',
        'developer',
        'PATCH',
        (): string => `/api/v1/projects/${records.projectA.id}`,
      ],
      [
        'a Developer',
        'developer',
        'PUT',
        (): string => `/api/v1/projects/${records.projectA.id}/archive`,
      ],
      [
        'a Developer',
        'developer',
        'DELETE',
        (): string => `/api/v1/projects/${records.projectA.id}`,
      ],
      [
        'a Developer',
        'developer',
        'POST',
        (): string => `/api/v1/projects/${records.projectA.id}/members`,
      ],
      [
        'a Developer',
        'developer',
        'GET',
        (): string => `/api/v1/projects/${records.projectA.id}/member-candidates`,
      ],
      [
        'an end user',
        'end_user_personal',
        'GET',
        (): string => `/api/v1/projects/${records.projectA.id}/members`,
      ],
      ['a Developer', 'developer', 'POST', (): string => '/api/v1/projects'],
    ] as const)('refuses %s (%s) %s with 403', async (_who, fixture, method, path) => {
      const body = path() === '/api/v1/projects' ? newProject() : {};

      const res = await http()
        [method.toLowerCase() as 'get'](path())
        .set('Authorization', await authorizationOf(fixture))
        .set('If-Match', 'W/"1"')
        .send(method === 'GET' || method === 'DELETE' ? undefined : body);

      expect(res.status).toBe(403);
    });

    it.each([
      ['GET', (): string => `/api/v1/organizations/${records.organization.id}`],
      ['PATCH', (): string => `/api/v1/organizations/${records.organization.id}`],
      ['PUT', (): string => `/api/v1/organizations/${records.organization.id}/archive`],
      ['DELETE', (): string => `/api/v1/organizations/${records.organization.id}/archive`],
      ['DELETE', (): string => `/api/v1/organizations/${records.organization.id}`],
      ['GET', (): string => `/api/v1/organizations/${records.organization.id}/members`],
      ['POST', (): string => `/api/v1/organizations/${records.organization.id}/members`],
      [
        'DELETE',
        (): string => `/api/v1/organizations/${records.organization.id}/members/${someone()}`,
      ],
      ['POST', (): string => `/api/v1/invitations/${records.projectInvitation.id}/resending`],
      ['POST', (): string => `/api/v1/invitations/${records.projectInvitation.id}/revocation`],
      ['POST', (): string => `/api/v1/users/${someone()}/deactivation`],
      ['POST', (): string => `/api/v1/users/${someone()}/reactivation`],
      ['PUT', (): string => `/api/v1/users/${someone()}/administrator-role`],
      ['DELETE', (): string => `/api/v1/users/${someone()}/administrator-role`],
    ] as const)('answers a Developer %s %s with 404', async (method, path) => {
      const res = await http()
        [method.toLowerCase() as 'get'](path())
        .set('Authorization', await authorizationOf('developer'))
        .set('If-Match', 'W/"1"')
        .send(method === 'GET' || method === 'DELETE' ? undefined : {});

      expect(res.status).toBe(404);
    });

    it.each([
      ['/api/v1/invitation-previews', 'projectB', 404],
      ['/api/v1/invitations', 'projectB', 404],
      ['/api/v1/invitation-previews', 'projectA', 403],
      ['/api/v1/invitations', 'projectA', 403],
    ] as const)('answers a Developer POST %s to %s with %i', async (path, project, status) => {
      const res = await http()
        .post(path)
        .set('Authorization', await authorizationOf('developer'))
        .send(invitationTo(records[project].id));

      expect(res.status).toBe(status);
    });

    // End users see their projects, so an invitation to one is forbidden, no longer invisible.
    it.each([
      ['/api/v1/invitation-previews', 'projectA', 403],
      ['/api/v1/invitations', 'projectA', 403],
      ['/api/v1/invitations', 'archivedProject', 409],
      ['/api/v1/invitations', 'projectB', 404],
    ] as const)('answers an end user POST %s to %s with %i', async (path, project, status) => {
      const res = await http()
        .post(path)
        .set('Authorization', await authorizationOf('end_user_personal'))
        .send(invitationTo(records[project].id));

      expect(res.status).toBe(status);
    });

    it('lists for a Developer no invitation they cannot see', async () => {
      const res = await http()
        .get('/api/v1/invitations')
        .query({ limit: 100 })
        .set('Authorization', await authorizationOf('developer'));

      expect(res.status).toBe(200);
      expect((res.body as ProjectPage).items.map(({ id }) => id)).not.toContain(
        records.projectInvitation.id,
      );
    });

    // Organizations, accounts and the Administrator panel are invisible to non-Administrators as
    // a whole: their lists and the creation answer `404` like their records (§7.5, §17.2).
    it.each([
      ['GET', '/api/v1/organizations', undefined],
      ['POST', '/api/v1/organizations', { name: 'Customer' }],
      ['GET', '/api/v1/users', undefined],
      ['GET', '/api/v1/administration/getting-started', undefined],
      ['GET', '/api/v1/administration/about', undefined],
    ] as const)('answers a Developer %s %s with 404', async (method, path, body) => {
      const res = await http()
        [method.toLowerCase() as 'get'](path)
        .set('Authorization', await authorizationOf('developer'))
        .send(body);

      expect(res.status).toBe(404);
    });
  });
});
