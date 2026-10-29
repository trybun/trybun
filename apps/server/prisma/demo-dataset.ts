// Deterministic demo dataset of the local environment and the E2E tests (§15.12): fixed IDs,
// fixed timestamps and a seeded Faker, so two runs load identical data.
import { createHash } from 'node:crypto';
import { base, en, Faker, pl } from '@faker-js/faker';
import type { ProductTourId } from '@trybun/contracts/product-tours';
import type { Prisma, PrismaClient } from '../src/generated/prisma/client.js';

const FAKER_SEED = 20_261_023;
const CREATED_AT = new Date('2026-01-05T08:00:00.000Z');
const END_USER_COUNT = 10;
/** The account without tour progress, for trying the product tours and their E2E tests (§2.4). */
export const NEWCOMER_EMAIL = 'newcomer@example.com';
/**
 * The current version of every product tour (`apps/web/src/features/product-tours/tours/`): the
 * other team accounts have completed them, so the tours interrupt neither demos nor E2E tests.
 */
const PRODUCT_TOUR_VERSIONS: Record<ProductTourId, number> = {
  first_login: 1,
  organization_detail: 1,
};

/**
 * The pending demo invitation expires long after the fixed timestamps, so it stays pending on
 * every run; issued invitations expire 7 days after issue (§7.4).
 */
const PENDING_INVITATION_EXPIRES_AT = new Date('2099-12-31T00:00:00.000Z');

export interface DemoDataset {
  users: Prisma.UserCreateManyInput[];
  productTourProgress: Prisma.ProductTourProgressCreateManyInput[];
  projects: Prisma.ProjectCreateManyInput[];
  projectMembers: Prisma.ProjectMemberCreateManyInput[];
  organizations: Prisma.OrganizationCreateManyInput[];
  organizationDomains: Prisma.OrganizationDomainCreateManyInput[];
  organizationProjects: Prisma.OrganizationProjectCreateManyInput[];
  organizationMembers: Prisma.OrganizationMemberCreateManyInput[];
  invitations: Prisma.InvitationCreateManyInput[];
}

/**
 * The demo projects (§3.1): two active ones and an archived one, with the manager as Project
 * manager and the other team accounts as Developers; the Administrator belongs to none, as the
 * role covers every project.
 */
const DEMO_PROJECTS = [
  { name: 'Customer portal', key: 'CP', state: 'active', members: ['manager', 'developer'] },
  {
    name: 'ERP',
    key: 'ERP',
    state: 'active',
    members: ['manager', 'developer', 'newcomer'],
  },
  { name: 'Legacy intranet', key: 'LEGACY', state: 'archived', members: ['manager', 'developer'] },
] as const;

/**
 * The demo organization (§7.3): the company of the end users, by their e-mail domain, with access
 * to the customer portal and the first end users as members; the others belong to none.
 */
const DEMO_ORGANIZATION = {
  name: 'Customer company',
  domain: 'customer.example.com',
  projectKeys: ['CP'],
  memberCount: 6,
} as const;

/**
 * The accounts of the invitations and of the deactivation (§7.4): an end user of the customer
 * company invited to the customer portal (pending, matched to the demo organization by the
 * domain), a team member whose invitation to the ERP expired, and a deactivated end user. None
 * has a Keycloak user, so none can sign in.
 */
const DEMO_INVITED_AND_DEACTIVATED = [
  {
    email: 'invited@customer.example.com',
    displayName: null,
    kind: 'end_user',
    state: 'invited',
  },
  { email: 'candidate@example.com', displayName: null, kind: 'team', state: 'invited' },
  {
    email: 'former@customer.example.com',
    displayName: 'Filip Former',
    kind: 'end_user',
    state: 'deactivated',
  },
] as const;

/**
 * The stored hash of a demo invitation's token (ADR 0009). The token is not published, so the
 * demo links do not work; **Copy new link** issues a working one.
 */
function demoTokenHash(n: number): string {
  return createHash('sha256').update(`demo-invitation-${n}`).digest('base64url');
}

/** UUIDv7 of the demo record number `n` (§17.2). */
export function demoId(n: number): string {
  return `019b8d00-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;
}

export function buildDemoDataset(): DemoDataset {
  const faker = new Faker({ locale: [pl, en, base], seed: FAKER_SEED });
  // Team accounts sign in with a password in the local environment only (§7.4); their Keycloak
  // users have the same IDs (docker/keycloak/dev/trybun-realm.json).
  const team: Prisma.UserCreateManyInput[] = [
    { email: 'admin@example.com', displayName: 'Ada Admin', isAdmin: true },
    { email: 'manager@example.com', displayName: 'Marek Manager' },
    { email: 'developer@example.com', displayName: 'Dorota Developer' },
    { email: NEWCOMER_EMAIL, displayName: 'Nina Newcomer' },
  ].map((account, index) => ({
    ...account,
    id: demoId(index + 1),
    keycloakUserId: demoId(index + 1),
    kind: 'team',
    state: 'active',
    language: 'pl',
    timeZone: 'Europe/Warsaw',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }));
  const endUsers = Array.from(
    { length: END_USER_COUNT },
    (_, index): Prisma.UserCreateManyInput => {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      return {
        id: demoId(100 + index),
        email: faker.internet
          .email({ firstName, lastName, provider: 'customer.example.com' })
          .toLowerCase(),
        displayName: `${firstName} ${lastName}`,
        kind: 'end_user',
        state: 'active',
        language: faker.helpers.arrayElement(['pl', 'en']),
        timeZone: 'Europe/Warsaw',
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      };
    },
  );
  const invitedAndDeactivated = DEMO_INVITED_AND_DEACTIVATED.map(
    (account, index): Prisma.UserCreateManyInput => ({
      ...account,
      id: demoId(150 + index),
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    }),
  );
  const productTourProgress = team
    .filter((account) => account.email !== NEWCOMER_EMAIL)
    .flatMap((account) =>
      Object.entries(PRODUCT_TOUR_VERSIONS).map(([tourId, tourVersion]) => ({
        userId: account.id ?? '',
        tourId,
        tourVersion,
        status: 'completed' as const,
        updatedAt: CREATED_AT,
      })),
    )
    .map((progress, index) => ({ ...progress, id: demoId(200 + index) }));
  const teamByName = {
    manager: team[1]?.id ?? '',
    developer: team[2]?.id ?? '',
    newcomer: team[3]?.id ?? '',
  };
  const projects = DEMO_PROJECTS.map(
    ({ name, key, state }, index): Prisma.ProjectCreateManyInput => ({
      id: demoId(300 + index),
      name,
      key,
      state,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    }),
  );
  const projectMembers = DEMO_PROJECTS.flatMap(({ members }, index) =>
    members.map((member): Prisma.ProjectMemberCreateManyInput => ({
      projectId: demoId(300 + index),
      userId: teamByName[member],
      role: member === 'manager' ? 'project_manager' : 'developer',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    })),
  );
  const organizationId = demoId(400);
  const invitedBy = { manager: team[1]?.id ?? '', admin: team[0]?.id ?? '' };
  const invitations: Prisma.InvitationCreateManyInput[] = [
    {
      id: demoId(500),
      userId: invitedAndDeactivated[0]?.id ?? '',
      target: 'project',
      projectId: projects[0]?.id ?? null,
      role: 'end_user',
      // The address's domain belongs to the demo organization, which has the project (§7.3).
      organizationId,
      invitedById: invitedBy.manager,
      tokenHash: demoTokenHash(500),
      expiresAt: PENDING_INVITATION_EXPIRES_AT,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    {
      id: demoId(501),
      userId: invitedAndDeactivated[1]?.id ?? '',
      target: 'project',
      projectId: projects[1]?.id ?? null,
      role: 'developer',
      invitedById: invitedBy.admin,
      tokenHash: demoTokenHash(501),
      expiresAt: new Date(CREATED_AT.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
  ];
  return {
    users: [...team, ...endUsers, ...invitedAndDeactivated],
    productTourProgress,
    projects,
    projectMembers,
    organizations: [
      {
        id: organizationId,
        name: DEMO_ORGANIZATION.name,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
    ],
    organizationDomains: [
      {
        id: demoId(401),
        organizationId,
        domain: DEMO_ORGANIZATION.domain,
        createdAt: CREATED_AT,
      },
    ],
    organizationProjects: projects
      .filter(({ key }) => (DEMO_ORGANIZATION.projectKeys as readonly string[]).includes(key))
      .map(({ id }) => ({ organizationId, projectId: id ?? '', createdAt: CREATED_AT })),
    organizationMembers: endUsers
      .slice(0, DEMO_ORGANIZATION.memberCount)
      .map(({ id }) => ({ organizationId, userId: id ?? '', createdAt: CREATED_AT })),
    invitations,
  };
}

/**
 * Loads the demo dataset; running it again restores the same records – also the tour progress,
 * so the newcomer sees the tours again, the demo projects with their members, the demo
 * organization with its domain, project access and members, and the demo invitations – a link
 * resent, revoked or accepted during a demo comes back as it was.
 */
export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  const dataset = buildDemoDataset();
  const { users, productTourProgress, projects, projectMembers, organizations } = dataset;
  await prisma.$transaction(async (tx) => {
    for (const user of users) {
      await tx.user.upsert({ where: { id: user.id }, create: user, update: user });
    }
    await tx.productTourProgress.deleteMany({
      where: { userId: { in: users.map((user) => user.id ?? '') } },
    });
    await tx.productTourProgress.createMany({ data: productTourProgress });
    for (const project of projects) {
      // The version is restored too, so a state changed during a demo comes back.
      const data = { ...project, version: 1 };
      await tx.project.upsert({ where: { id: project.id }, create: data, update: data });
    }
    await tx.projectMember.deleteMany({
      where: { projectId: { in: projects.map((project) => project.id ?? '') } },
    });
    await tx.projectMember.createMany({ data: projectMembers });
    // Deleting the organization removes its domains, project access and members (§7.3).
    await tx.organization.deleteMany({
      where: { id: { in: organizations.map((organization) => organization.id ?? '') } },
    });
    // A member moved or a domain taken over during a demo comes back too.
    await tx.organizationMember.deleteMany({
      where: { userId: { in: dataset.organizationMembers.map(({ userId }) => userId) } },
    });
    await tx.organizationDomain.deleteMany({
      where: { domain: { in: dataset.organizationDomains.map(({ domain }) => domain) } },
    });
    await tx.organization.createMany({ data: organizations });
    await tx.organizationDomain.createMany({ data: dataset.organizationDomains });
    await tx.organizationProject.createMany({ data: dataset.organizationProjects });
    await tx.organizationMember.createMany({ data: dataset.organizationMembers });
    // Deleted after the organization, whose deletion cascades to the matched invitation.
    await tx.invitation.deleteMany({
      where: { id: { in: dataset.invitations.map((invitation) => invitation.id ?? '') } },
    });
    await tx.invitation.createMany({ data: dataset.invitations });
  });
}
