// The QA page records of the QA test environment (#440): an opt-in addition to the demo dataset
// (§15.12) with more records than one page of a list holds (`DEFAULT_PAGE_LIMIT`, §18.4), so a
// QA reviewer sees **Load more**. Fixed IDs and recognizable values ("QA page …", addresses
// `qa-page-…@example.org`, project keys `QAP…`), so removing them touches nothing else. The
// demo dataset's restore on every boot (`seedDemoData`) keeps them – except the tickets: they keep
// the demo organization of their requester, whose tickets it removes; adding them again restores
// them.
import { DEFAULT_PAGE_LIMIT } from '@trybun/contracts/pagination';
import type { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import {
  ATTACHMENT_DELETED,
  type AttachmentDeletedPayload,
} from '../src/modules/attachments/attachments.events.js';
import { buildDemoDataset } from './demo-dataset.js';

/** The records of each kind: a full first page and a second one, whatever else the list holds. */
export const QA_PAGE_COUNT = DEFAULT_PAGE_LIMIT + 5;
const CREATED_AT = new Date('2026-01-04T08:00:00.000Z');
/** The demo end user of the portal who requests the QA page tickets (S1-09). */
const REQUESTER_EMAIL = 'customer@customer.example.com';

/**
 * UUIDv7 of the QA page record number `n` (§17.2): the time of the demo IDs, with a variant
 * nibble of its own (`9`), so no demo ID (`8`) can be one.
 */
export function qaPageId(n: number): string {
  return `019b8d00-0000-7000-9000-${n.toString(16).padStart(12, '0')}`;
}

/** The PostgreSQL the QA test environment publishes on the host (`compose.dev.yaml`). */
const TEST_ENVIRONMENT_DATABASE_PORT = '5432';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Whether `databaseUrl` reaches the PostgreSQL published on the host port that
 * `test-env-pages.sh` checks belongs to the Compose project `trybun-test`: a `DATABASE_URL` of
 * another host or port (exported in the shell, or set in `.env`) never gets the records.
 */
export function isTestEnvironmentDatabase(databaseUrl: string): boolean {
  const url = URL.parse(databaseUrl);
  return (
    url !== null &&
    (url.protocol === 'postgresql:' || url.protocol === 'postgres:') &&
    LOOPBACK_HOSTS.has(url.hostname) &&
    (url.port === '' ? '5432' : url.port) === TEST_ENVIRONMENT_DATABASE_PORT
  );
}

export interface QaPagesDataset {
  users: Prisma.UserCreateManyInput[];
  organizations: Prisma.OrganizationCreateManyInput[];
  organizationMembers: Prisma.OrganizationMemberCreateManyInput[];
  projects: Prisma.ProjectCreateManyInput[];
  organizationProjects: Prisma.OrganizationProjectCreateManyInput[];
  projectMembers: Prisma.ProjectMemberCreateManyInput[];
  tickets: Prisma.TicketCreateManyInput[];
  ticketNumberCounters: Prisma.TicketNumberCounterCreateManyInput[];
}

/**
 * The QA page records and the lists they fill past one page:
 * - the accounts – **Accounts**; end users without a Keycloak user, so none signs in;
 * - the organizations – **Organizations**;
 * - the projects – **Projects** of the Administrator;
 * - "QA page organization 01": all accounts as members and access to all projects – its
 *   **Members** and **Projects**;
 * - "QA page project 01": all accounts as End users, access of all organizations and the tickets
 *   – its **Members**, **Organizations** and the team's ticket list filtered by it; the tickets are
 *   requested by the demo portal user "Celina Customer", who has personal access to the project –
 *   her **My tickets** in the portal.
 */
export function buildQaPagesDataset(): QaPagesDataset {
  const demo = buildDemoDataset();
  const requesterId = demo.users.find(({ email }) => email === REQUESTER_EMAIL)?.id ?? '';
  // The requester's organization at creation (§3.2).
  const requesterOrganizationId =
    demo.organizationMembers.find(({ userId }) => userId === requesterId)?.organizationId ?? null;
  const numbers = Array.from({ length: QA_PAGE_COUNT }, (_, index) => index + 1);
  const label = (n: number) => n.toString().padStart(2, '0');
  const users = numbers.map((n): Prisma.UserCreateManyInput => ({
    id: qaPageId(n),
    email: `qa-page-${label(n)}@example.org`,
    displayName: `QA page account ${label(n)}`,
    kind: 'end_user',
    state: 'active',
    language: 'en',
    timeZone: 'Europe/Warsaw',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }));
  const organizations = numbers.map((n): Prisma.OrganizationCreateManyInput => ({
    id: qaPageId(100 + n),
    name: `QA page organization ${label(n)}`,
    state: 'active',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }));
  const projects = numbers.map((n): Prisma.ProjectCreateManyInput => ({
    id: qaPageId(200 + n),
    name: `QA page project ${label(n)}`,
    key: `QAP${label(n)}`,
    state: 'active',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }));
  const [organization] = organizations;
  const [project] = projects;
  const organizationId = organization?.id ?? '';
  const projectId = project?.id ?? '';
  const tickets = numbers.map((n): Prisma.TicketCreateManyInput => {
    // A minute apart, so every sort of the list has one order.
    const createdAt = new Date(CREATED_AT.getTime() + n * 60 * 1000);
    return {
      id: qaPageId(300 + n),
      projectId,
      number: n,
      title: `QA page ticket ${label(n)}`,
      source: 'user',
      priority: 'normal',
      status: 'new',
      organizationId: requesterOrganizationId,
      requesterId,
      createdAt,
      updatedAt: createdAt,
    };
  });
  return {
    users,
    organizations,
    organizationMembers: users.map(({ id }) => ({
      organizationId,
      userId: id ?? '',
      createdAt: CREATED_AT,
    })),
    projects,
    organizationProjects: [
      ...projects.map(({ id }) => ({ organizationId, projectId: id ?? '', createdAt: CREATED_AT })),
      ...organizations
        .filter(({ id }) => id !== organizationId)
        .map(({ id }) => ({ organizationId: id ?? '', projectId, createdAt: CREATED_AT })),
    ],
    projectMembers: [requesterId, ...users.map(({ id }) => id ?? '')].map(
      (userId): Prisma.ProjectMemberCreateManyInput => ({
        projectId,
        userId,
        role: 'end_user',
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      }),
    ),
    tickets,
    ticketNumberCounters: [{ projectId, lastNumber: QA_PAGE_COUNT }],
  };
}

/**
 * Removes the QA page records with everything that belongs to them, also what was added to them
 * during the QA: the tickets of their projects (with their relations, activity, comments and
 * attachments), the members, access and invitations of their projects and organizations, and the
 * memberships and invitations of their accounts. A record outside them that refers to one of them
 * – e.g. a ticket of a demo project with a QA page organization – stops the removal with a
 * foreign-key error, so nothing else is ever deleted; the transaction then changes nothing.
 */
async function removeQaPageRecords(tx: Prisma.TransactionClient, dataset: QaPagesDataset) {
  const userIds = dataset.users.map(({ id }) => id ?? '');
  const organizationIds = dataset.organizations.map(({ id }) => id ?? '');
  const projectIds = dataset.projects.map(({ id }) => id ?? '');
  const qaTickets = { projectId: { in: projectIds } } satisfies Prisma.TicketWhereInput;
  // A ticket's original cannot be deleted while a relation points to it: the relations of the
  // tickets first. One from a ticket outside them stops the removal (see above).
  await tx.ticketRelation.deleteMany({ where: { sourceTicket: { is: qaTickets } } });
  // The attachments restrict the deletion of their tickets; their objects are removed by the
  // Worker's `attachment.deleted` job, as in `seedDemoData` (S1-08).
  const attachments = await tx.attachment.findMany({
    where: {
      OR: [{ ticket: { is: qaTickets } }, { comment: { is: { ticket: { is: qaTickets } } } }],
    },
    select: { id: true },
  });
  await tx.attachment.deleteMany({ where: { id: { in: attachments.map(({ id }) => id) } } });
  await tx.outboxEvent.createMany({
    data: attachments.map(({ id }) => ({
      type: ATTACHMENT_DELETED,
      payload: { attachmentId: id } satisfies AttachmentDeletedPayload,
    })),
  });
  // Deleting a ticket removes its events and comments.
  await tx.ticket.deleteMany({ where: qaTickets });
  // The memberships and invitations of the accounts restrict their deletion; those of the
  // projects and organizations, their access and counters go with them.
  await tx.organizationMember.deleteMany({ where: { userId: { in: userIds } } });
  await tx.projectMember.deleteMany({ where: { userId: { in: userIds } } });
  await tx.invitation.deleteMany({ where: { userId: { in: userIds } } });
  await tx.project.deleteMany({ where: { id: { in: projectIds } } });
  await tx.organization.deleteMany({ where: { id: { in: organizationIds } } });
  await tx.user.deleteMany({ where: { id: { in: userIds } } });
}

/**
 * Adds the QA page records; running it again restores them as they were added, like the demo
 * dataset (`seedDemoData`). Needs the demo dataset, whose Project manager they refer to.
 */
export async function addQaPages(prisma: PrismaClient): Promise<void> {
  const dataset = buildQaPagesDataset();
  await prisma.$transaction(async (tx) => {
    await removeQaPageRecords(tx, dataset);
    await tx.user.createMany({ data: dataset.users });
    await tx.organization.createMany({ data: dataset.organizations });
    await tx.organizationMember.createMany({ data: dataset.organizationMembers });
    await tx.project.createMany({ data: dataset.projects });
    await tx.organizationProject.createMany({ data: dataset.organizationProjects });
    await tx.projectMember.createMany({ data: dataset.projectMembers });
    await tx.ticket.createMany({ data: dataset.tickets });
    await tx.ticketNumberCounter.createMany({ data: dataset.ticketNumberCounters });
  });
}

/** Removes the QA page records (see `removeQaPageRecords`); none present is no error. */
export async function removeQaPages(prisma: PrismaClient): Promise<void> {
  const dataset = buildQaPagesDataset();
  await prisma.$transaction((tx) => removeQaPageRecords(tx, dataset));
}
