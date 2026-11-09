// The permission layer end to end (§7.5, §14.4, §18.3, §18.7): the access of every principal
// fixture to real records, lists that equal details, the actions of the project response and the
// denied case of every endpoint.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { accessibleBy } from '@casl/prisma/runtime';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AttachmentPage } from '@trybun/contracts/attachments';
import { type Project, type ProjectPage, projectActionSchema } from '@trybun/contracts/projects';
import { type Ticket, ticketActionSchema } from '@trybun/contracts/tickets';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { keycloakJwksHandler, signAccessToken } from '../test/factories/access-token.factory.js';
import { createAttachment } from '../test/factories/attachment.factory.js';
import { createComment } from '../test/factories/comment.factory.js';
import { createInvitation } from '../test/factories/invitation.factory.js';
import { createOrganization } from '../test/factories/organization.factory.js';
import { PRINCIPAL_FIXTURES, type PrincipalFixture } from '../test/factories/principal.factory.js';
import { createProjectMember } from '../test/factories/project-member.factory.js';
import { buildProjectKey, createProject } from '../test/factories/project.factory.js';
import { createTicket } from '../test/factories/ticket.factory.js';
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
import { strictEndUserProjectSchema, strictPageSchema } from '../test/end-user-schemas.js';
import { SystemClock } from './platform/clock/clock.js';

/** The project actions of the Administrator: all but the end users' visibility of a new ticket. */
const TEAM_PROJECT_ACTIONS = projectActionSchema.options.filter(
  (action) =>
    action !== 'create_ticket_my_organization' && action !== 'create_ticket_all_customers',
);

describe('permission layer', () => {
  const config = integrationConfig();
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  const abilities = new AbilityFactory(
    ABILITY_DEFINITIONS.rules,
    ABILITY_DEFINITIONS.restrictions,
    new SystemClock(),
  );

  /** The records of this test: an active project A, a project B and an archived project. */
  const records = {} as {
    projectA: { id: string };
    projectB: { id: string };
    archivedProject: { id: string };
    organization: { id: string };
    archivedOrganization: { id: string };
    projectInvitation: { id: string };
    organizationInvitation: { id: string };
    teamTicket: { id: string };
    personalTicket: { id: string };
    organizationTicket: { id: string };
    archivedTicket: { id: string };
    ticketB: { id: string };
    colleagueTicket: { id: string };
    sharedTicket: { id: string };
  };
  /** Drafts and attachments of the tickets and comments above. */
  const attachments: { id: string }[] = [];
  /** Comments and internal notes of the tickets above, with their kinds and audiences (S1-12). */
  const comments: { id: string }[] = [];
  /** The public comment of each end-user ticket by its requester. */
  const commentsOf = {} as Record<string, { id: string }>;
  /** The attachments of the tickets above by their requester and by the Developer, by ticket. */
  const attachmentsOf = {} as Record<
    'teamTicket' | 'personalTicket' | 'organizationTicket' | 'archivedTicket' | 'ticketB',
    { byRequester: { id: string }; byDeveloper: { id: string } }
  >;
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
    // Tickets of project A by the Developer and by both end users with access, a ticket of the
    // archived project by the end user with personal access, and one of project B by the end user
    // of the archived organization, created while it was active.
    records.teamTicket = await createTicket(prisma, {
      projectId: records.projectA.id,
      requesterId: users.developer.id,
    });
    records.personalTicket = await createTicket(prisma, {
      projectId: records.projectA.id,
      requesterId: users.end_user_personal.id,
      source: 'user',
      status: 'new',
      type: null,
    });
    records.organizationTicket = await createTicket(prisma, {
      projectId: records.projectA.id,
      requesterId: users.end_user_organization.id,
      organizationId: records.organization.id,
      source: 'user',
      status: 'new',
      type: null,
    });
    records.archivedTicket = await createTicket(prisma, {
      projectId: records.archivedProject.id,
      requesterId: users.end_user_personal.id,
      source: 'user',
      status: 'new',
      type: null,
    });
    records.ticketB = await createTicket(prisma, {
      projectId: records.projectB.id,
      requesterId: users.end_user_archived_organization.id,
      organizationId: records.archivedOrganization.id,
      source: 'user',
      status: 'new',
      type: null,
    });
    // S1-11: a `my_organization` ticket of a colleague of the active organization and a shared
    // ticket of the end user of that organization, both in project A.
    const colleague = await createUser(prisma);
    await prisma.organizationMember.create({
      data: { userId: colleague.id, organizationId: records.organization.id },
    });
    records.colleagueTicket = await createTicket(prisma, {
      projectId: records.projectA.id,
      requesterId: colleague.id,
      organizationId: records.organization.id,
      source: 'user',
      status: 'new',
      type: null,
      visibility: 'my_organization',
    });
    records.sharedTicket = await createTicket(prisma, {
      projectId: records.projectA.id,
      requesterId: users.end_user_organization.id,
      organizationId: records.organization.id,
      source: 'user',
      status: 'new',
      type: null,
      visibility: 'all_customers',
    });
    // Drafts of a team member and of an end user, and an attachment of each ticket by its
    // requester and by the Developer.
    attachments.push(
      await createAttachment(prisma, { uploadedById: users.developer.id }),
      await createAttachment(prisma, { uploadedById: users.end_user_personal.id }),
    );
    for (const name of [
      'teamTicket',
      'personalTicket',
      'organizationTicket',
      'archivedTicket',
      'ticketB',
    ] as const) {
      const ticket = records[name];
      const { requesterId } = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        select: { requesterId: true },
      });
      const byRequester = await createAttachment(prisma, {
        uploadedById: requesterId,
        ticketId: ticket.id,
      });
      // The Developer requested the team ticket: one attachment for both.
      const byDeveloper =
        requesterId === users.developer.id
          ? byRequester
          : await createAttachment(prisma, {
              uploadedById: users.developer.id,
              ticketId: ticket.id,
            });
      attachmentsOf[name] = { byRequester, byDeveloper };
      attachments.push(...new Set([byRequester, byDeveloper]));
    }
    // S1-12: a public comment of each end-user ticket by its requester with the ticket's
    // visibility as its audience, an internal note and a public comment of the Developer, a
    // comment of the shared ticket written while it was `my_organization`, and an attachment of a
    // note and of a public comment.
    for (const name of [
      'personalTicket',
      'organizationTicket',
      'archivedTicket',
      'ticketB',
      'colleagueTicket',
      'sharedTicket',
    ] as const) {
      const ticket = await prisma.ticket.findUniqueOrThrow({
        where: { id: records[name].id },
        select: { id: true, requesterId: true, visibility: true, organizationId: true },
      });
      const audience = {
        audience: ticket.visibility,
        audienceOrganizationId:
          ticket.visibility === 'my_organization' ? ticket.organizationId : null,
      };
      const byRequester = await createComment(prisma, {
        ticketId: ticket.id,
        authorId: ticket.requesterId,
        ...audience,
      });
      const note = await createComment(prisma, {
        ticketId: ticket.id,
        authorId: users.developer.id,
        kind: 'internal',
      });
      const byDeveloper = await createComment(prisma, {
        ticketId: ticket.id,
        authorId: users.developer.id,
        ...audience,
      });
      comments.push(byRequester, note, byDeveloper);
      commentsOf[name] = byRequester;
      attachments.push(
        await createAttachment(prisma, { uploadedById: users.developer.id, commentId: note.id }),
        await createAttachment(prisma, {
          uploadedById: ticket.requesterId,
          commentId: byRequester.id,
        }),
      );
    }
    comments.push(
      await createComment(prisma, {
        ticketId: records.sharedTicket.id,
        authorId: users.end_user_organization.id,
        audience: 'my_organization',
        audienceOrganizationId: records.organization.id,
      }),
    );
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
      // End users receive the reduced shape, without the role and the settings (Q7).
      strictPageSchema(strictEndUserProjectSchema).parse(res.body);
    });

    it.each(['end_user_personal', 'end_user_organization'] as const)(
      'shows project A to %s in the end-user shape',
      async (fixture) => {
        const res = await http()
          .get(`/api/v1/projects/${records.projectA.id}`)
          .set('Authorization', await authorizationOf(fixture));

        expect(res.status).toBe(200);
        expect(strictEndUserProjectSchema.parse(res.body)).toMatchObject({
          // `my_organization` only where the organization has access to the project (S1-11 Q19).
          allowedActions:
            fixture === 'end_user_organization'
              ? [
                  'read',
                  'create_ticket',
                  'create_ticket_my_organization',
                  'create_ticket_all_customers',
                ]
              : ['read', 'create_ticket', 'create_ticket_all_customers'],
        });
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
      expect(res.body).toMatchObject({ role: null, allowedActions: TEAM_PROJECT_ACTIONS });
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
        case 'Ticket':
          return prisma.ticket.findMany({
            where: { AND: [accessibleBy(ability, 'read').ofType('Ticket'), where] },
            select,
          });
        case 'Attachment':
          return prisma.attachment.findMany({
            where: { AND: [accessibleBy(ability, 'read').ofType('Attachment'), where] },
            select,
          });
        case 'Comment':
          return prisma.comment.findMany({
            where: { AND: [accessibleBy(ability, 'read').ofType('Comment'), where] },
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
          Ticket: [
            records.teamTicket.id,
            records.personalTicket.id,
            records.organizationTicket.id,
            records.archivedTicket.id,
            records.ticketB.id,
            records.colleagueTicket.id,
            records.sharedTicket.id,
          ],
          Attachment: attachments.map(({ id }) => id),
          Comment: comments.map(({ id }) => id),
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
      ['admin', 'projectA', TEAM_PROJECT_ACTIONS],
      ['admin', 'archivedProject', ['read', 'unarchive', 'read_members']],
      [
        'project_manager',
        'projectA',
        [
          'read',
          'update_settings',
          'read_members',
          'manage_members',
          'create_ticket',
          'assign_tickets',
          'assign_tickets_self',
        ],
      ],
      ['project_manager', 'archivedProject', ['read', 'read_members']],
      ['developer', 'projectA', ['read', 'read_members', 'create_ticket', 'assign_tickets_self']],
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

  describe('the actions of the ticket response (§7.5, §18.3)', () => {
    const TEAM_TICKET_ACTIONS = ticketActionSchema.options.filter(
      (action) =>
        action !== 'confirm_resolution' &&
        !action.startsWith('set_visibility_') &&
        !action.endsWith('_sharing'),
    );
    it.each([
      // Answering the resolution confirmation belongs to the requester only (S1-04 Q3).
      // A team ticket has no visibility actions: it is visible to the team only (S1-11 Q6).
      ['admin', 'teamTicket', TEAM_TICKET_ACTIONS],
      ['project_manager', 'teamTicket', TEAM_TICKET_ACTIONS],
      [
        'developer',
        'teamTicket',
        [
          'read',
          'update',
          'update_fields',
          'assign_self',
          'change_status',
          'add_attachment',
          'add_comment',
          'add_internal_note',
          'read_description_revisions',
          'redact_description',
        ],
      ],
      ['admin', 'archivedTicket', ['read', 'read_description_revisions']],
      [
        'end_user_personal',
        'personalTicket',
        [
          'read',
          'update',
          'add_attachment',
          'set_visibility_all_customers',
          'add_comment',
          'read_description_revisions',
        ],
      ],
      [
        'end_user_organization',
        'organizationTicket',
        [
          'read',
          'update',
          'add_attachment',
          'set_visibility_my_organization',
          'set_visibility_all_customers',
          'add_comment',
          'read_description_revisions',
        ],
      ],
      ['end_user_personal', 'archivedTicket', ['read', 'read_description_revisions']],
      // A requester keeps reading – and commenting on – a ticket after losing access to its
      // project ("read and comment", §7.3).
      [
        'end_user_archived_organization',
        'ticketB',
        ['read', 'add_comment', 'read_description_revisions'],
      ],
      // S1-11: reading a colleague's or a shared ticket gives no change of the ticket (§7.5), but
      // everyone who reads a ticket comments on it (S1-12).
      ['end_user_organization', 'colleagueTicket', ['read', 'add_comment']],
      ['end_user_personal', 'sharedTicket', ['read', 'add_comment']],
    ] as const)('lists for %s on %s exactly %o', async (fixture, ticket, actions) => {
      const res = await http()
        .get(`/api/v1/tickets/${records[ticket].id}`)
        .set('Authorization', await authorizationOf(fixture));

      expect(res.status).toBe(200);
      expect((res.body as Ticket).allowedActions).toEqual(actions);
    });

    it.each([
      ['team_member', 'teamTicket'],
      ['end_user_personal', 'teamTicket'],
      ['end_user_personal', 'organizationTicket'],
      ['end_user', 'personalTicket'],
      ['developer', 'ticketB'],
      // S1-11: a colleague's ticket outside the organization, a shared one without project access.
      ['end_user_personal', 'colleagueTicket'],
      ['end_user_archived_organization', 'sharedTicket'],
      ['end_user', 'sharedTicket'],
    ] as const)('hides from %s the ticket %s (404)', async (fixture, ticket) => {
      const res = await http()
        .get(`/api/v1/tickets/${records[ticket].id}`)
        .set('Authorization', await authorizationOf(fixture));

      expect(res.status).toBe(404);
    });
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

    /** Requests of a Developer of project A: `404` for a ticket of project B, as for a missing one. */
    it.each([
      ['GET', (id: string) => `/api/v1/tickets/${id}`],
      ['PATCH', (id: string) => `/api/v1/tickets/${id}`],
      ['GET', (id: string) => `/api/v1/tickets/${id}/activity-events`],
      ['GET', (id: string) => `/api/v1/tickets/${id}/attachments`],
      ['POST', (id: string) => `/api/v1/tickets/${id}/attachments`],
      ['GET', (id: string) => `/api/v1/tickets/${id}/comments`],
      ['POST', (id: string) => `/api/v1/tickets/${id}/comments`],
      ['GET', (id: string) => `/api/v1/tickets/${id}/timeline`],
      ['GET', (id: string) => `/api/v1/tickets/${id}/description-revisions`],
      ['POST', (id: string) => `/api/v1/tickets/${id}/mention-candidates`],
      ['POST', (id: string) => `/api/v1/tickets/${id}/description-redaction`],
    ] as const)(
      'answers %s %s of a ticket of project B with 404, as for a missing ticket',
      async (method, path) => {
        const authorization = await authorizationOf('developer');
        const send = (id: string) =>
          http()
            [method.toLowerCase() as 'get'](path(id))
            .set('Authorization', authorization)
            .set('If-Match', 'W/"1"')
            .send(method === 'GET' ? undefined : { title: 'Changed' });

        const invisible = await send(records.ticketB.id);
        const missing = await send(randomUUID());

        expect(invisible.status).toBe(404);
        expect({ ...invisible.body, instance: undefined }).toEqual({
          ...missing.body,
          instance: undefined,
        });
      },
    );

    /** Requests of a Developer of project A: `404` for a comment of project B, as for a missing one. */
    it.each([
      ['GET', (id: string) => `/api/v1/comments/${id}`],
      ['PATCH', (id: string) => `/api/v1/comments/${id}`],
      ['DELETE', (id: string) => `/api/v1/comments/${id}`],
      ['POST', (id: string) => `/api/v1/comments/${id}/redaction`],
      ['GET', (id: string) => `/api/v1/comments/${id}/revisions`],
    ] as const)(
      'answers %s %s of a comment of project B with 404, as for a missing comment',
      async (method, path) => {
        const authorization = await authorizationOf('developer');
        const send = (id: string) =>
          http()
            [method.toLowerCase() as 'get'](path(id))
            .set('Authorization', authorization)
            .set('If-Match', 'W/"1"');

        const invisible = await send(commentsOf.ticketB?.id ?? '');
        const missing = await send(randomUUID());

        expect(invisible.status).toBe(404);
        expect({ ...invisible.body, instance: undefined }).toEqual({
          ...missing.body,
          instance: undefined,
        });
      },
    );

    /** Requests of a Developer of project A: `404` for an attachment of project B, as for a missing one. */
    it.each([
      ['GET', (id: string) => `/api/v1/attachments/${id}`],
      ['GET', (id: string) => `/api/v1/attachments/${id}/content`],
      ['DELETE', (id: string) => `/api/v1/attachments/${id}`],
    ] as const)(
      'answers %s %s of an attachment of project B with 404, as for a missing attachment',
      async (method, path) => {
        const authorization = await authorizationOf('developer');
        const send = (id: string) =>
          http()[method.toLowerCase() as 'get'](path(id)).set('Authorization', authorization);

        const invisible = await send(attachmentsOf.ticketB.byRequester.id);
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
        "an end user deleting the Developer's attachment",
        'end_user_personal',
        'DELETE',
        () => `/api/v1/attachments/${attachmentsOf.personalTicket.byDeveloper.id}`,
        403,
      ],
      [
        'a requester without access deleting their own attachment',
        'end_user_archived_organization',
        'DELETE',
        () => `/api/v1/attachments/${attachmentsOf.ticketB.byRequester.id}`,
        403,
      ],
      [
        'a requester without access adding an attachment',
        'end_user_archived_organization',
        'POST',
        () => `/api/v1/tickets/${records.ticketB.id}/attachments`,
        403,
      ],
      [
        'an end user deleting their own attachment of an archived project',
        'end_user_personal',
        'DELETE',
        () => `/api/v1/attachments/${attachmentsOf.archivedTicket.byRequester.id}`,
        409,
      ],
      [
        'a Developer adding an attachment in an archived project',
        'developer',
        'POST',
        () => `/api/v1/tickets/${records.archivedTicket.id}/attachments`,
        409,
      ],
    ] as const)('refuses %s with %i', async (_case, fixture, method, path, status) => {
      const res = await http()
        [method.toLowerCase() as 'post'](path())
        .set('Authorization', await authorizationOf(fixture))
        .send(method === 'POST' ? { attachmentIds: [randomUUID()] } : undefined);

      expect(res.status).toBe(status);
    });

    it.each(PRINCIPAL_FIXTURES)(
      'lists for %s by ID only the attachments its detail check allows',
      async (fixture) => {
        const ability = abilities.forPrincipal(principalOf(fixture));
        const readable = await prisma.attachment.findMany({
          where: {
            AND: [
              accessibleBy(ability, 'read').ofType('Attachment'),
              { id: { in: attachments.map(({ id }) => id) } },
            ],
          },
          select: { id: true },
        });

        const res = await http()
          .get('/api/v1/attachments')
          .query({ id: attachments.map(({ id }) => id) })
          .set('Authorization', await authorizationOf(fixture));

        expect(res.status).toBe(200);
        expect((res.body as AttachmentPage).items.map(({ id }) => id).sort()).toEqual(
          readable.map(({ id }) => id).sort(),
        );
      },
    );

    it.each([
      [
        'a Developer assigning someone else',
        'developer',
        'teamTicket',
        () => ({
          assigneeId: users.project_manager.id,
        }),
        403,
      ],
      [
        'an end user changing the priority',
        'end_user_personal',
        'personalTicket',
        () => ({
          priority: 'high',
        }),
        403,
      ],
      [
        'a requester without access editing',
        'end_user_archived_organization',
        'ticketB',
        () => ({
          title: 'Changed',
        }),
        403,
      ],
      [
        'an end user editing a ticket of an archived project',
        'end_user_personal',
        'archivedTicket',
        () => ({
          title: 'Changed',
        }),
        409,
      ],
    ] as const)('refuses %s with %i', async (_case, fixture, ticket, body, status) => {
      const res = await http()
        .patch(`/api/v1/tickets/${records[ticket].id}`)
        .set('Authorization', await authorizationOf(fixture))
        .set('If-Match', 'W/"1"')
        .send(body());

      expect(res.status).toBe(status);
    });

    it.each([
      ['a Developer', 'developer', 'projectB', {}, 404],
      ['a team account without membership', 'team_member', 'projectA', {}, 404],
      ['a Developer', 'developer', 'archivedProject', {}, 409],
      ['an end user', 'end_user_personal', 'archivedProject', {}, 409],
      [
        'an end user with a field of the full form',
        'end_user_personal',
        'projectA',
        { type: 'bug' },
        403,
      ],
    ] as const)(
      'refuses %s (%s) a ticket in %s with %i',
      async (_who, fixture, project, extra, status) => {
        const res = await http()
          .post('/api/v1/tickets')
          .set('Authorization', await authorizationOf(fixture))
          .send({ projectId: records[project].id, title: 'New', ...extra });

        expect(res.status).toBe(status);
      },
    );

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
    // a whole: their lists and the creation answer `404` like their records (§7.5, §17.2). The one
    // exception is the list of organizations, which gives a team member the names of the
    // organizations of their projects (S1-13 Q6) and is checked below.
    it.each([
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

    it('lists for a Developer only the ID and name of the organizations of their projects (S1-13 Q6)', async () => {
      const res = await http()
        .get('/api/v1/organizations')
        .query({ limit: 100 })
        .set('Authorization', await authorizationOf('developer'));

      expect(res.status).toBe(200);
      for (const item of (res.body as { items: object[] }).items) {
        expect(Object.keys(item).sort()).toEqual(['id', 'name']);
      }
    });
  });
});
