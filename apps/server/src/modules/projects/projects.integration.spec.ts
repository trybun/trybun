import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  ProjectMemberPage,
  ProjectPage,
  Project as ProjectResponse,
} from '@trybun/contracts/projects';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../generated/prisma/client.js';
import {
  keycloakJwksHandler,
  signAccessToken,
} from '../../../test/factories/access-token.factory.js';
import { createProjectMember } from '../../../test/factories/project-member.factory.js';
import { buildProjectKey, createProject } from '../../../test/factories/project.factory.js';
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
import { archivedProjectsRestriction, projectsAbilities } from './projects.abilities.js';
import { ProjectsModule } from './projects.module.js';

type Who = 'admin' | 'project_manager' | 'developer' | 'outsider' | 'end_user';

describe('projects endpoints', () => {
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
          rules: [projectsAbilities],
          restrictions: [archivedProjectsRestriction],
        }),
        ProjectsModule,
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
  async function signIn(
    who: Who,
    options: { project?: Project; displayName?: string | null; githubLogin?: string } = {},
  ) {
    const user = await createUser(prisma, {
      keycloakUserId: randomUUID(),
      kind: who === 'end_user' ? 'end_user' : 'team',
      isAdmin: who === 'admin',
      ...(options.displayName === undefined ? {} : { displayName: options.displayName }),
      ...(options.githubLogin === undefined ? {} : { githubLogin: options.githubLogin }),
    });
    if (options.project !== undefined && (who === 'project_manager' || who === 'developer')) {
      await createProjectMember(prisma, {
        projectId: options.project.id,
        userId: user.id,
        role: who,
      });
    }
    const token = await signAccessToken(config, {
      sub: user.keycloakUserId ?? '',
      amr: who === 'end_user' ? ['pwd'] : ['pwd', 'otp'],
    });
    return { user, authorization: `Bearer ${token}` };
  }

  async function auditEntries(projectId: string) {
    return prisma.auditLogEntry.findMany({
      where: { targetType: 'Project', targetId: projectId },
      select: { action: true, actorId: true, details: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  const ifMatch = (project: { version: number }) => `W/"${project.version}"`;

  describe('creating', () => {
    it('creates a project for the Administrator, with its audit entry', async () => {
      const { user, authorization } = await signIn('admin');
      const key = buildProjectKey();

      const res = await http()
        .post('/api/v1/projects')
        .set('Authorization', authorization)
        .send({ name: '  ERP system  ', key });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'ERP system',
        key,
        state: 'active',
        confirmResolution: false,
        role: null,
        version: 1,
      });
      expect((res.body as ProjectResponse).allowedActions).toContain('archive');
      expect(await auditEntries((res.body as ProjectResponse).id)).toEqual([
        { action: 'project.created', actorId: user.id, details: null },
      ]);
    });

    it.each(['erp', '1ERP'])('rejects the key %s with string.invalid_format', async (key) => {
      const { authorization } = await signIn('admin');

      const res = await http()
        .post('/api/v1/projects')
        .set('Authorization', authorization)
        .send({ name: 'ERP', key });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        code: 'request.validation_failed',
        errors: [{ pointer: '/key', code: 'string.invalid_format' }],
      });
    });

    it.each(['active', 'archived'] as const)(
      'rejects the key of an %s project with project.key_taken',
      async (state) => {
        const { authorization } = await signIn('admin');
        const existing = await createProject(prisma, { state });

        const res = await http()
          .post('/api/v1/projects')
          .set('Authorization', authorization)
          .send({ name: 'ERP', key: existing.key });

        expect(res.status).toBe(422);
        expect(res.body).toMatchObject({
          code: 'project.key_taken',
          errors: [{ pointer: '/key', code: 'field.invalid' }],
        });
      },
    );

    it('creates one of two concurrent projects with one key', async () => {
      const { authorization } = await signIn('admin');
      const key = buildProjectKey();

      const responses = await Promise.all(
        [1, 2].map(() =>
          http()
            .post('/api/v1/projects')
            .set('Authorization', authorization)
            .send({ name: 'A', key }),
        ),
      );

      expect(responses.map((res) => res.status).sort()).toEqual([201, 422]);
      expect(responses.find((res) => res.status === 422)?.body).toMatchObject({
        code: 'project.key_taken',
      });
    });

    it.each(['project_manager', 'end_user'] as const)('is forbidden for a %s', async (who) => {
      const { authorization } = await signIn(who, { project: await createProject(prisma) });

      const res = await http()
        .post('/api/v1/projects')
        .set('Authorization', authorization)
        .send({ name: 'ERP', key: buildProjectKey() });

      expect(res.status).toBe(403);
    });
  });

  describe('reading', () => {
    it('lists only the projects of a team member, sorted by name, page by page', async () => {
      const projects = await Promise.all(
        ['Bravo', 'Alpha', 'Charlie'].map((name) => createProject(prisma, { name })),
      );
      const [bravo, alpha, charlie] = projects as [Project, Project, Project];
      const { user, authorization } = await signIn('developer', { project: alpha });
      await createProjectMember(prisma, { projectId: charlie.id, userId: user.id });
      await createProject(prisma, { name: 'Alpha (other)' });

      const first = await http()
        .get('/api/v1/projects?limit=1')
        .set('Authorization', authorization);
      const second = await http()
        .get(`/api/v1/projects?limit=1&cursor=${String((first.body as ProjectPage).nextCursor)}`)
        .set('Authorization', authorization);

      expect(first.body).toMatchObject({ items: [{ id: alpha.id }] });
      expect(second.body).toMatchObject({ items: [{ id: charlie.id }], nextCursor: null });
      expect(JSON.stringify(second.body)).not.toContain(bravo.id);
    });

    it('lists archived projects on request', async () => {
      const archived = await createProject(prisma, { state: 'archived' });
      const { authorization } = await signIn('developer', { project: archived });

      const active = await http().get('/api/v1/projects').set('Authorization', authorization);
      const res = await http()
        .get('/api/v1/projects?state=archived')
        .set('Authorization', authorization);

      expect(active.body).toEqual({ items: [], nextCursor: null });
      expect(res.body).toMatchObject({ items: [{ id: archived.id, state: 'archived' }] });
    });

    it('rejects a cursor of another list with 422', async () => {
      const { authorization } = await signIn('admin');

      const res = await http()
        .get('/api/v1/projects?cursor=bm90LWEtY3Vyc29y')
        .set('Authorization', authorization);

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ errors: [{ pointer: '/cursor', code: 'field.invalid' }] });
    });

    it('returns a project with its weak ETag', async () => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('developer', { project });

      const res = await http()
        .get(`/api/v1/projects/${project.id}`)
        .set('Authorization', authorization);

      expect(res.status).toBe(200);
      expect(res.headers.etag).toBe('W/"1"');
      expect(res.body).toMatchObject({
        id: project.id,
        role: 'developer',
        allowedActions: ['read', 'read_members'],
      });
    });

    it('returns 404 to a Developer of project A for project B and its members', async () => {
      const projectA = await createProject(prisma);
      const projectB = await createProject(prisma);
      const { authorization } = await signIn('developer', { project: projectA });

      const detail = await http()
        .get(`/api/v1/projects/${projectB.id}`)
        .set('Authorization', authorization);
      const members = await http()
        .get(`/api/v1/projects/${projectB.id}/members`)
        .set('Authorization', authorization);

      expect([detail.status, members.status]).toEqual([404, 404]);
    });

    it('shows an end user no project and answers 404 for one and its members', async () => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('end_user');

      const list = await http().get('/api/v1/projects').set('Authorization', authorization);
      const detail = await http()
        .get(`/api/v1/projects/${project.id}`)
        .set('Authorization', authorization);
      const members = await http()
        .get(`/api/v1/projects/${project.id}/members`)
        .set('Authorization', authorization);

      expect(list.body).toEqual({ items: [], nextCursor: null });
      expect([detail.status, members.status]).toEqual([404, 404]);
    });

    it('requires a signed-in account', async () => {
      expect((await http().get('/api/v1/projects')).status).toBe(401);
    });
  });

  describe('allowed actions', () => {
    it.each([
      [
        'admin',
        'active',
        [
          'read',
          'update',
          'update_settings',
          'archive',
          'unarchive',
          'delete',
          'read_members',
          'manage_members',
        ],
      ],
      ['admin', 'archived', ['read', 'unarchive', 'read_members']],
      ['project_manager', 'active', ['read', 'update_settings', 'read_members', 'manage_members']],
      ['project_manager', 'archived', ['read', 'read_members']],
      ['developer', 'active', ['read', 'read_members']],
      ['developer', 'archived', ['read', 'read_members']],
    ] as const)('lists for a %s on an %s project exactly %j', async (who, state, actions) => {
      const project = await createProject(prisma, { state });
      const { authorization } = await signIn(who, { project });

      const res = await http()
        .get(`/api/v1/projects/${project.id}`)
        .set('Authorization', authorization);

      expect(res.body).toMatchObject({ allowedActions: actions });
    });
  });

  describe('changing', () => {
    it('lets a Project manager change resolution confirmation', async () => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('project_manager', { project });

      const res = await http()
        .patch(`/api/v1/projects/${project.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(project))
        .send({ confirmResolution: true });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ confirmResolution: true, version: 2 });
      expect(res.headers.etag).toBe('W/"2"');
    });

    it('rejects a Project manager body that also changes the name, changing nothing', async () => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('project_manager', { project });

      const res = await http()
        .patch(`/api/v1/projects/${project.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(project))
        .send({ confirmResolution: true, name: 'Renamed' });

      expect(res.status).toBe(403);
      expect(await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({
        name: project.name,
        confirmResolution: false,
        version: 1,
      });
    });

    it('lets the Administrator change the name and the key', async () => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('admin');
      const key = buildProjectKey();

      const res = await http()
        .patch(`/api/v1/projects/${project.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(project))
        .send({ name: 'Renamed', key });

      expect(res.body).toMatchObject({ name: 'Renamed', key, version: 2 });
    });

    it('rejects the key of another project with project.key_taken', async () => {
      const project = await createProject(prisma);
      const other = await createProject(prisma);
      const { authorization } = await signIn('admin');

      const res = await http()
        .patch(`/api/v1/projects/${project.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(project))
        .send({ key: other.key });

      expect(res.body).toMatchObject({ code: 'project.key_taken' });
    });

    it('gives one key to only one of two concurrent changes', async () => {
      const projects = [await createProject(prisma), await createProject(prisma)];
      const { authorization } = await signIn('admin');
      const key = buildProjectKey();

      const responses = await Promise.all(
        projects.map((project) =>
          http()
            .patch(`/api/v1/projects/${project.id}`)
            .set('Authorization', authorization)
            .set('If-Match', ifMatch(project))
            .send({ key }),
        ),
      );

      expect(responses.map((res) => res.status).sort()).toEqual([200, 422]);
      expect(responses.find((res) => res.status === 422)?.body).toMatchObject({
        code: 'project.key_taken',
      });
    });

    it.each([
      [undefined, 428],
      ['W/"7"', 412],
    ])('answers the If-Match %s with %i', async (header, status) => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('admin');

      const req = http()
        .patch(`/api/v1/projects/${project.id}`)
        .set('Authorization', authorization)
        .send({ name: 'Renamed' });
      const res = await (header === undefined ? req : req.set('If-Match', header));

      expect(res.status).toBe(status);
    });

    it('returns 403 to a Developer', async () => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('developer', { project });

      const res = await http()
        .patch(`/api/v1/projects/${project.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(project))
        .send({ confirmResolution: true });

      expect(res.status).toBe(403);
    });
  });

  describe('archiving', () => {
    it('archives and unarchives a project with their audit entries', async () => {
      const project = await createProject(prisma);
      const { user, authorization } = await signIn('admin');

      const archived = await http()
        .put(`/api/v1/projects/${project.id}/archive`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(project));
      const unarchived = await http()
        .delete(`/api/v1/projects/${project.id}/archive`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(archived.body as ProjectResponse));

      expect(archived.body).toMatchObject({ state: 'archived', version: 2 });
      expect(unarchived.status).toBe(204);
      expect(await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({
        state: 'active',
        version: 3,
      });
      expect(await auditEntries(project.id)).toEqual([
        { action: 'project.archived', actorId: user.id, details: null },
        { action: 'project.unarchived', actorId: user.id, details: null },
      ]);
    });

    it('unarchives an active project with 204, no change and no audit entry', async () => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('admin');

      const res = await http()
        .delete(`/api/v1/projects/${project.id}/archive`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(project));
      const stale = await http()
        .delete(`/api/v1/projects/${project.id}/archive`)
        .set('Authorization', authorization)
        .set('If-Match', 'W/"9"');

      expect([res.status, stale.status]).toEqual([204, 412]);
      expect(await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({
        version: 1,
      });
      expect(await auditEntries(project.id)).toEqual([]);
    });

    it('refuses every write of the module on an archived project with 409, for the Administrator too', async () => {
      const project = await createProject(prisma, { state: 'archived' });
      const member = await createUser(prisma, { kind: 'team' });
      await createProjectMember(prisma, { projectId: project.id, userId: member.id });
      const candidate = await createUser(prisma, { kind: 'team' });
      const { authorization } = await signIn('admin');
      const path = `/api/v1/projects/${project.id}`;

      const responses = await Promise.all(
        [
          http().patch(path).set('If-Match', ifMatch(project)).send({ name: 'Renamed' }),
          http().patch(path).set('If-Match', ifMatch(project)).send({ confirmResolution: true }),
          http().put(`${path}/archive`).set('If-Match', ifMatch(project)),
          http().delete(path).set('If-Match', ifMatch(project)),
          http().post(`${path}/members`).send({ userId: candidate.id, role: 'developer' }),
          http().patch(`${path}/members/${member.id}`).send({ role: 'project_manager' }),
          http().delete(`${path}/members/${member.id}`),
          http().get(`${path}/member-candidates`),
        ].map((req) => req.set('Authorization', authorization)),
      );

      for (const res of responses) {
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: 'project.archived' });
      }
      expect(await prisma.projectMember.count({ where: { projectId: project.id } })).toBe(1);
    });

    it('returns 404, not 409, for an archived project the principal cannot see', async () => {
      const project = await createProject(prisma, { state: 'archived' });
      const { authorization } = await signIn('developer', { project: await createProject(prisma) });

      const res = await http()
        .put(`/api/v1/projects/${project.id}/archive`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(project));

      expect(res.status).toBe(404);
    });
  });

  describe('deleting', () => {
    it('deletes a project with its memberships and frees its key', async () => {
      const project = await createProject(prisma);
      const member = await createUser(prisma, { kind: 'team' });
      await createProjectMember(prisma, { projectId: project.id, userId: member.id });
      const { user, authorization } = await signIn('admin');

      const res = await http()
        .delete(`/api/v1/projects/${project.id}`)
        .set('Authorization', authorization)
        .set('If-Match', ifMatch(project));
      const reused = await http()
        .post('/api/v1/projects')
        .set('Authorization', authorization)
        .send({ name: 'Again', key: project.key });

      expect(res.status).toBe(204);
      expect(await prisma.projectMember.count({ where: { projectId: project.id } })).toBe(0);
      expect(await auditEntries(project.id)).toEqual([
        { action: 'project.deleted', actorId: user.id, details: null },
      ]);
      expect(reused.status).toBe(201);
    });
  });

  describe('members', () => {
    async function addMember(authorization: string, project: Project, userId: string) {
      return http()
        .post(`/api/v1/projects/${project.id}/members`)
        .set('Authorization', authorization)
        .send({ userId, role: 'developer' });
    }

    it('lists the members sorted by display name, accounts without one last, with a role filter', async () => {
      const project = await createProject(prisma);
      const { user: viewer, authorization } = await signIn('developer', {
        project,
        displayName: 'Bea',
      });
      for (const [displayName, role] of [
        ['Adam', 'project_manager'],
        [null, 'developer'],
        ['Cyril', 'developer'],
      ] as const) {
        const user = await createUser(prisma, { kind: 'team', displayName });
        await createProjectMember(prisma, { projectId: project.id, userId: user.id, role });
      }

      const pages: ProjectMemberPage['items'] = [];
      let cursor: string | null = null;
      do {
        const query: string = cursor === null ? 'limit=2' : `limit=2&cursor=${cursor}`;
        const res = await http()
          .get(`/api/v1/projects/${project.id}/members?${query}`)
          .set('Authorization', authorization);
        const page = res.body as ProjectMemberPage;
        pages.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor !== null);
      const managers = await http()
        .get(`/api/v1/projects/${project.id}/members?role=project_manager`)
        .set('Authorization', authorization);

      expect(pages.map((member) => member.user.displayName)).toEqual([
        'Adam',
        'Bea',
        'Cyril',
        null,
      ]);
      expect(pages[1]).toEqual({
        user: { id: viewer.id, displayName: 'Bea', githubLogin: null },
        role: 'developer',
        createdAt: expect.any(String) as string,
      });
      expect(managers.body).toMatchObject({ items: [{ user: { displayName: 'Adam' } }] });
    });

    it('lets a Project manager add, re-role and remove a member, each with its audit entry', async () => {
      const project = await createProject(prisma);
      const { user: manager, authorization } = await signIn('project_manager', { project });
      const member = await createUser(prisma, { kind: 'team' });
      const path = `/api/v1/projects/${project.id}/members/${member.id}`;

      const added = await addMember(authorization, project, member.id);
      const changed = await http()
        .patch(path)
        .set('Authorization', authorization)
        .send({ role: 'project_manager' });
      const removed = await http().delete(path).set('Authorization', authorization);

      expect(added.status).toBe(201);
      expect(added.body).toMatchObject({ user: { id: member.id }, role: 'developer' });
      expect(changed.body).toMatchObject({ role: 'project_manager' });
      expect(removed.status).toBe(204);
      expect(await auditEntries(project.id)).toEqual([
        {
          action: 'project_member.added',
          actorId: manager.id,
          details: { userId: member.id, role: 'developer' },
        },
        {
          action: 'project_member.role_changed',
          actorId: manager.id,
          details: { userId: member.id, role: 'project_manager', previousRole: 'developer' },
        },
        {
          action: 'project_member.removed',
          actorId: manager.id,
          details: { userId: member.id, role: 'project_manager' },
        },
      ]);
    });

    it('allows removing the last Project manager', async () => {
      const project = await createProject(prisma);
      const manager = await createUser(prisma, { kind: 'team' });
      await createProjectMember(prisma, {
        projectId: project.id,
        userId: manager.id,
        role: 'project_manager',
      });
      const { authorization } = await signIn('admin');

      const res = await http()
        .delete(`/api/v1/projects/${project.id}/members/${manager.id}`)
        .set('Authorization', authorization);

      expect(res.status).toBe(204);
    });

    it.each([
      ['an end user', { kind: 'end_user' }],
      ['a deactivated team member', { kind: 'team', state: 'deactivated' }],
      ['an invited team member', { kind: 'team', state: 'invited' }],
    ] as const)('rejects %s with project_member.user_not_eligible', async (_case, account) => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('admin');
      const user = await createUser(prisma, account);

      const res = await addMember(authorization, project, user.id);

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        code: 'project_member.user_not_eligible',
        errors: [{ pointer: '/userId', code: 'field.invalid' }],
      });
    });

    it('rejects an existing member with project_member.exists', async () => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('admin');
      const user = await createUser(prisma, { kind: 'team' });
      await createProjectMember(prisma, { projectId: project.id, userId: user.id });

      const res = await addMember(authorization, project, user.id);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'project_member.exists' });
    });

    it('adds one of two concurrent additions of one account', async () => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('admin');
      const user = await createUser(prisma, { kind: 'team' });

      const responses = await Promise.all(
        [1, 2].map(() => addMember(authorization, project, user.id)),
      );

      expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
      expect(responses.find((res) => res.status === 409)?.body).toMatchObject({
        code: 'project_member.exists',
      });
      expect(await prisma.projectMember.count({ where: { projectId: project.id } })).toBe(1);
    });

    it.each([
      ['changed', 'patch'],
      ['removed', 'delete'],
    ] as const)('returns 404 when a non-member is %s', async (_case, method) => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('admin');
      const user = await createUser(prisma, { kind: 'team' });

      const res = await http()
        [method](`/api/v1/projects/${project.id}/members/${user.id}`)
        .set('Authorization', authorization)
        .send({ role: 'developer' });

      expect(res.status).toBe(404);
    });

    it('returns 403 to a Developer who adds a member', async () => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('developer', { project });
      const user = await createUser(prisma, { kind: 'team' });

      const res = await addMember(authorization, project, user.id);

      expect(res.status).toBe(403);
    });

    it('adds no member to a project archived while the addition waits for it', async () => {
      const project = await createProject(prisma);
      const { authorization } = await signIn('admin');
      const user = await createUser(prisma, { kind: 'team' });

      let addition: Promise<request.Response> | undefined;
      await prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: project.id },
          data: { state: 'archived', version: { increment: 1 } },
        });
        addition = addMember(authorization, project, user.id).then((res) => res);
        // Commit only once the addition has passed the target record guard and waits for the row
        // lock, so the test exercises the lock rather than the guard.
        await vi.waitFor(
          async () => {
            const [waiting] = await prisma.$queryRaw<[{ count: bigint }]>`
              SELECT count(*) FROM pg_stat_activity
              WHERE wait_event_type = 'Lock' AND query LIKE '%FOR SHARE%'`;
            expect(waiting.count).toBe(1n);
          },
          { timeout: 5000, interval: 20 },
        );
      });
      const res = await (addition as Promise<request.Response>);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'project.archived' });
      expect(await prisma.projectMember.count({ where: { projectId: project.id } })).toBe(0);
    });
  });

  describe('member candidates', () => {
    it('lists active team accounts that are not members, without e-mail addresses, searchable', async () => {
      const project = await createProject(prisma);
      const login = `cand${randomUUID().slice(0, 8)}`;
      const { authorization } = await signIn('project_manager', { project });
      const candidate = await createUser(prisma, {
        kind: 'team',
        displayName: 'Zoe Candidate',
        githubLogin: login,
      });
      for (const account of [
        { kind: 'end_user', githubLogin: `${login}-end` },
        { kind: 'team', state: 'deactivated', githubLogin: `${login}-off` },
      ] as const) {
        await createUser(prisma, account);
      }
      const member = await createUser(prisma, { kind: 'team', githubLogin: `${login}-member` });
      await createProjectMember(prisma, { projectId: project.id, userId: member.id });

      const res = await http()
        .get(`/api/v1/projects/${project.id}/member-candidates?query=${login.toUpperCase()}`)
        .set('Authorization', authorization);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        items: [{ id: candidate.id, displayName: 'Zoe Candidate', githubLogin: login }],
        nextCursor: null,
      });
    });

    it('returns 403 to a Developer of the project and 404 for another project', async () => {
      const project = await createProject(prisma);
      const other = await createProject(prisma);
      const { authorization } = await signIn('developer', { project });

      const own = await http()
        .get(`/api/v1/projects/${project.id}/member-candidates`)
        .set('Authorization', authorization);
      const foreign = await http()
        .get(`/api/v1/projects/${other.id}/member-candidates`)
        .set('Authorization', authorization);

      expect([own.status, foreign.status]).toEqual([403, 404]);
    });
  });

  it('returns 404 to a team member outside the project', async () => {
    const project = await createProject(prisma);
    const { authorization } = await signIn('outsider');

    const res = await http()
      .get(`/api/v1/projects/${project.id}`)
      .set('Authorization', authorization);

    expect(res.status).toBe(404);
  });
});
