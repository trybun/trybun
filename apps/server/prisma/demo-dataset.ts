// Deterministic demo dataset of the local environment and the E2E tests (§15.12): fixed IDs,
// fixed timestamps and a seeded Faker, so two runs load identical data.
import { createHash } from 'node:crypto';
import { base, en, Faker, pl } from '@faker-js/faker';
import type { ProductTourId } from '@trybun/contracts/product-tours';
import { publicStatusOf } from '@trybun/contracts/tickets';
import type { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import {
  ATTACHMENT_DELETED,
  type AttachmentDeletedPayload,
} from '../src/modules/attachments/attachments.events.js';

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
  tickets: Prisma.TicketCreateManyInput[];
  ticketRelations: Prisma.TicketRelationCreateManyInput[];
  ticketNumberCounters: Prisma.TicketNumberCounterCreateManyInput[];
  activityEvents: Prisma.ActivityEventCreateManyInput[];
}

/**
 * The demo projects (§3.1): two active ones and an archived one, with the manager as Project
 * manager and the other team accounts as Developers; the Administrator belongs to none, as the
 * role covers every project.
 */
const DEMO_PROJECTS = [
  {
    name: 'Customer portal',
    key: 'CP',
    state: 'active',
    members: ['manager', 'developer'],
    confirmResolution: true,
  },
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
 * The end users who sign in to the portal in the local environment and the E2E tests (§5.7); their
 * Keycloak users have the same IDs (docker/keycloak/dev/trybun-realm.json). The customer works in
 * one project, the customer portal of their organization; the partner also has personal access to
 * the ERP, so they choose between two projects.
 */
export const DEMO_PORTAL_USERS = [
  {
    key: 'customer',
    email: 'customer@customer.example.com',
    displayName: 'Celina Customer',
    personalProjectKeys: [],
  },
  {
    key: 'partner',
    email: 'partner@customer.example.com',
    displayName: 'Piotr Partner',
    personalProjectKeys: ['ERP'],
  },
] as const;

/**
 * The demo tickets (§3.2) in the active projects and the archived one: every source, type and
 * priority, the end users' tickets with the organization of their requester, some assigned. They
 * start in their initial statuses; `DEMO_STATUS_CHANGES` moves some of them. `events` are the
 * field changes recorded after the creation (§4.5), by the account named in `by`.
 */
const DEMO_TICKETS = [
  {
    project: 'CP',
    title: 'Cannot download the invoice PDF',
    description: 'The **Download** button on the invoice page does nothing since Monday.',
    requester: 'endUser0',
    source: 'user',
    type: null,
    priority: 'normal',
    assignee: null,
    events: [],
  },
  {
    project: 'CP',
    title: 'How do I change the e-mail address of my account?',
    description: '',
    requester: 'endUser1',
    source: 'user',
    type: 'question',
    priority: 'low',
    assignee: null,
    events: [{ by: 'developer', field: 'type', from: null, to: 'question' }],
  },
  {
    project: 'CP',
    title: 'Sign-in page crashes on Safari',
    description: 'Safari 26 shows a blank page after the sign-in button is pressed.',
    requester: 'manager',
    source: 'developer',
    type: 'bug',
    priority: 'critical',
    assignee: 'developer',
    events: [
      { by: 'manager', field: 'priority', from: 'normal', to: 'critical' },
      { by: 'manager', field: 'assignee', from: null, to: 'developer' },
    ],
  },
  {
    project: 'CP',
    title: 'Export the invoice list to CSV',
    description: 'Customers ask for a CSV export of all invoices of a year.',
    requester: 'developer',
    source: 'developer',
    type: 'feature',
    priority: 'low',
    assignee: 'developer',
    events: [],
  },
  {
    project: 'CP',
    title: 'TypeError in checkout.js',
    description: "Cannot read properties of undefined (reading 'total') at checkout.js:118",
    requester: 'admin',
    source: 'integration',
    type: 'bug',
    priority: 'high',
    assignee: null,
    events: [],
  },
  {
    project: 'ERP',
    title: 'Speed up the monthly closing report',
    description: 'The report takes more than ten minutes for the largest company.',
    requester: 'manager',
    source: 'developer',
    type: 'task',
    priority: 'high',
    assignee: 'newcomer',
    events: [
      {
        by: 'manager',
        field: 'title',
        from: 'Report slow',
        to: 'Speed up the monthly closing report',
      },
      { by: 'manager', field: 'assignee', from: null, to: 'newcomer' },
    ],
  },
  {
    project: 'ERP',
    title: 'Add the cost centre to purchase orders',
    description: '',
    requester: 'developer',
    source: 'developer',
    type: 'feature',
    priority: 'normal',
    assignee: null,
    events: [{ by: 'developer', field: 'description', from: null, to: null }],
  },
  {
    project: 'LEGACY',
    title: 'Migrate the phone book to the customer portal',
    description: '',
    requester: 'manager',
    source: 'developer',
    type: 'task',
    priority: 'normal',
    assignee: null,
    events: [],
  },
  {
    project: 'CP',
    title: 'Invoice PDF does not download',
    description: 'Clicking **Download** on an invoice has no effect.',
    requester: 'endUser1',
    source: 'user',
    type: null,
    priority: 'normal',
    assignee: null,
    events: [],
  },
  // The tickets of the customer in every public status of §4.2 (S1-09); `DEMO_STATUS_CHANGES`
  // moves them.
  {
    project: 'CP',
    title: 'The order history loads slowly',
    description: 'Opening **Orders** takes about 20 seconds.',
    requester: 'customer',
    source: 'user',
    type: null,
    priority: 'normal',
    assignee: null,
    events: [],
  },
  {
    project: 'CP',
    title: 'Add a dark theme',
    description: 'Working in the evening would be easier on the eyes.',
    requester: 'customer',
    source: 'user',
    type: null,
    priority: 'low',
    assignee: null,
    events: [],
  },
  {
    project: 'CP',
    title: 'Wrong VAT rate on the March invoice',
    description: 'The invoice shows 23% instead of 8% for the books.',
    requester: 'customer',
    source: 'user',
    type: null,
    priority: 'normal',
    assignee: 'developer',
    // Internal changes: never shown to the requester (§4.5).
    events: [
      { by: 'manager', field: 'priority', from: 'normal', to: 'high' },
      { by: 'manager', field: 'assignee', from: null, to: 'developer' },
    ],
  },
  {
    project: 'CP',
    title: 'Cannot change my password',
    description: 'The **Save** button stays disabled.',
    requester: 'customer',
    source: 'user',
    type: null,
    priority: 'normal',
    assignee: 'developer',
    events: [],
  },
  {
    project: 'CP',
    title: 'Export the delivery notes',
    description: 'I need the delivery notes of last year.',
    requester: 'customer',
    source: 'user',
    type: null,
    priority: 'low',
    assignee: null,
    events: [],
  },
  {
    project: 'CP',
    title: 'The newsletter link is broken',
    description: 'The link in the October newsletter leads to a 404 page.',
    requester: 'customer',
    source: 'user',
    type: null,
    priority: 'low',
    assignee: null,
    events: [],
  },
  {
    project: 'CP',
    title: 'Pay invoices with a gift card',
    description: '',
    requester: 'customer',
    source: 'user',
    type: null,
    priority: 'low',
    assignee: null,
    events: [],
  },
  {
    project: 'ERP',
    title: 'Access to the supplier reports',
    description: 'Our purchasing team needs the supplier reports.',
    requester: 'partner',
    source: 'user',
    type: null,
    priority: 'normal',
    assignee: null,
    events: [],
  },
] as const;

/**
 * The status changes of demo tickets after their field changes (§4.3), in order, by their index in
 * `DEMO_TICKETS`: a ticket that waits for the confirmation of its resolution (the Customer portal
 * asks for it) and a duplicate of it; the customer's tickets in every public status (S1-09) – one
 * scheduled, one under test after internal moves, one waiting for confirmation, one waiting for
 * information, one resolved and one rejected.
 */
const DEMO_STATUS_CHANGES = [
  { ticket: 0, by: 'developer', to: 'waiting_for_requester', waitingReason: 'confirmation' },
  { ticket: 8, by: 'developer', to: 'duplicate', duplicateOf: 0 },
  { ticket: 10, by: 'manager', to: 'todo' },
  { ticket: 11, by: 'developer', to: 'in_progress' },
  { ticket: 11, by: 'developer', to: 'in_verification' },
  { ticket: 12, by: 'developer', to: 'in_progress' },
  { ticket: 12, by: 'developer', to: 'waiting_for_requester', waitingReason: 'confirmation' },
  { ticket: 13, by: 'manager', to: 'waiting_for_requester', waitingReason: 'information' },
  { ticket: 14, by: 'developer', to: 'done' },
  {
    ticket: 15,
    by: 'manager',
    to: 'rejected',
    rejectionReason: 'Gift cards are not part of our payment terms.',
  },
] as const;

/** The event type of a change of a field of a demo ticket (§4.5). */
const EVENT_TYPE_OF_FIELD = {
  title: 'title_changed',
  description: 'description_edited',
  type: 'type_changed',
  priority: 'priority_changed',
  assignee: 'assignee_changed',
} as const;

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
    // Deactivated and reactivated by the E2E test of deactivation, so no other test signs in as it.
    { email: 'leaver@example.com', displayName: 'Leon Leaver' },
  ].map((account, index) => ({
    ...account,
    id: demoId(index + 1),
    keycloakUserId: demoId(index + 1),
    kind: 'team',
    state: 'active',
    language: 'pl',
    timeZone: 'Europe/Warsaw',
    // Restored on every load, as the tour progress: the E2E test of "Hide events" changes it.
    hideTimelineEvents: false,
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
  const portalUsers = DEMO_PORTAL_USERS.map(
    ({ email, displayName }, index): Prisma.UserCreateManyInput => ({
      id: demoId(160 + index),
      keycloakUserId: demoId(160 + index),
      email,
      displayName,
      kind: 'end_user',
      state: 'active',
      language: 'pl',
      timeZone: 'Europe/Warsaw',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    }),
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
  const projects = DEMO_PROJECTS.map((project, index): Prisma.ProjectCreateManyInput => ({
    id: demoId(300 + index),
    name: project.name,
    key: project.key,
    state: project.state,
    confirmResolution: 'confirmResolution' in project ? project.confirmResolution : false,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }));
  const projectMembers = [
    ...DEMO_PROJECTS.flatMap(({ members }, index) =>
      members.map((member): Prisma.ProjectMemberCreateManyInput => ({
        projectId: demoId(300 + index),
        userId: teamByName[member],
        role: member === 'manager' ? 'project_manager' : 'developer',
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      })),
    ),
    // Personal access of end users (§7.3).
    ...DEMO_PORTAL_USERS.flatMap(({ personalProjectKeys }, userIndex) =>
      personalProjectKeys.map((key): Prisma.ProjectMemberCreateManyInput => ({
        projectId: demoId(300 + DEMO_PROJECTS.findIndex((project) => project.key === key)),
        userId: portalUsers[userIndex]?.id ?? '',
        role: 'end_user',
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      })),
    ),
  ];
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
  const organizationMemberIds = [
    ...endUsers.slice(0, DEMO_ORGANIZATION.memberCount).map(({ id }) => id ?? ''),
    ...portalUsers.map(({ id }) => id ?? ''),
  ];
  const { tickets, ticketRelations, ticketNumberCounters, activityEvents } = buildDemoTickets(
    [...team, ...endUsers, ...portalUsers],
    projects,
    organizationId,
    organizationMemberIds,
  );
  return {
    users: [...team, ...endUsers, ...portalUsers, ...invitedAndDeactivated],
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
    organizationMembers: organizationMemberIds.map((userId) => ({
      organizationId,
      userId,
      createdAt: CREATED_AT,
    })),
    invitations,
    tickets,
    ticketRelations,
    ticketNumberCounters,
    activityEvents,
  };
}

/**
 * The demo tickets with their numbers – consecutive per project from 1 – the counters at the last
 * number, and their activity events, each a day after the previous one.
 */
function buildDemoTickets(
  accounts: Prisma.UserCreateManyInput[],
  projects: Prisma.ProjectCreateManyInput[],
  organizationId: string,
  organizationMembers: string[],
): Pick<DemoDataset, 'tickets' | 'ticketRelations' | 'ticketNumberCounters' | 'activityEvents'> {
  const accountIds: Record<string, string> = {
    admin: accounts[0]?.id ?? '',
    manager: accounts[1]?.id ?? '',
    developer: accounts[2]?.id ?? '',
    newcomer: accounts[3]?.id ?? '',
    endUser0: accounts[5]?.id ?? '',
    endUser1: accounts[6]?.id ?? '',
    ...Object.fromEntries(
      DEMO_PORTAL_USERS.map(({ key, email }) => [
        key,
        accounts.find((account) => account.email === email)?.id ?? '',
      ]),
    ),
  };
  const snapshotOf = (name: string | null) => {
    if (name === null) {
      return null;
    }
    const account = accounts.find(({ id }) => id === accountIds[name]);
    return { id: account?.id ?? '', displayName: account?.displayName ?? null };
  };
  const numbers = new Map<string, number>();
  const tickets: Prisma.TicketCreateManyInput[] = [];
  const activityEvents: Prisma.ActivityEventCreateManyInput[] = [];
  const ticketRelations: Prisma.TicketRelationCreateManyInput[] = [];
  DEMO_TICKETS.forEach((ticket, index) => {
    const projectId = projects.find(({ key }) => key === ticket.project)?.id ?? '';
    const number = (numbers.get(projectId) ?? 0) + 1;
    numbers.set(projectId, number);
    const id = demoId(600 + index);
    const requesterId = accountIds[ticket.requester] ?? '';
    const createdAt = new Date(CREATED_AT.getTime() + (index + 1) * 24 * 60 * 60 * 1000);
    tickets.push({
      id,
      projectId,
      number,
      title: ticket.title,
      description: ticket.description,
      type: ticket.type,
      source: ticket.source,
      priority: ticket.priority,
      status: ticket.source === 'developer' ? 'todo' : 'new',
      organizationId: organizationMembers.includes(requesterId) ? organizationId : null,
      requesterId,
      assigneeId: ticket.assignee === null ? null : (accountIds[ticket.assignee] ?? null),
      version: 1 + ticket.events.length,
      createdAt,
      updatedAt: createdAt,
    });
    ticket.events.forEach((event, eventIndex) => {
      const isReference = event.field === 'assignee';
      activityEvents.push({
        id: demoId(700 + index * 10 + eventIndex),
        ticketId: id,
        type: EVENT_TYPE_OF_FIELD[event.field],
        data:
          event.field === 'description'
            ? undefined
            : isReference
              ? { from: snapshotOf(event.from), to: snapshotOf(event.to) }
              : { from: event.from, to: event.to },
        actorId: accountIds[event.by] ?? null,
        createdAt: new Date(createdAt.getTime() + (eventIndex + 1) * 60 * 60 * 1000),
      });
    });
  });
  DEMO_STATUS_CHANGES.forEach((change, index) => {
    const ticket = tickets[change.ticket];
    if (ticket === undefined) {
      return;
    }
    const from = ticket.status;
    // Successive changes of one ticket an hour apart.
    const changedAt = new Date(
      (ticket.updatedAt as Date).getTime() +
        (ticket.updatedAt === ticket.createdAt ? 12 : 1) * 60 * 60 * 1000,
    );
    const original = 'duplicateOf' in change ? tickets[change.duplicateOf] : undefined;
    const originalKey = projects.find(({ id }) => id === original?.projectId)?.key ?? '';
    const duplicateOf =
      original === undefined
        ? null
        : { id: original.id ?? '', number: original.number, projectKey: originalKey };
    const waitingReason = 'waitingReason' in change ? change.waitingReason : null;
    Object.assign(ticket, {
      status: change.to,
      ...(waitingReason === null
        ? {}
        : { waitingReason, statusBeforeWaiting: from, waitingSince: changedAt }),
      ...(['done', 'rejected', 'duplicate'].includes(change.to) ? { closedAt: changedAt } : {}),
      ...('rejectionReason' in change ? { rejectionReason: change.rejectionReason } : {}),
      version: (ticket.version ?? 1) + 1,
      updatedAt: changedAt,
    });
    if (duplicateOf !== null) {
      ticketRelations.push({
        id: demoId(900 + index),
        kind: 'duplicate_of',
        sourceTicketId: ticket.id ?? '',
        targetTicketId: duplicateOf.id,
        createdAt: changedAt,
      });
    }
    activityEvents.push({
      id: demoId(800 + index),
      ticketId: ticket.id ?? '',
      type: 'status_changed',
      data: { from, to: change.to, reopen: false, waitingReason, duplicateOf },
      actorId: accountIds[change.by] ?? null,
      isPublic: publicStatusOf(from) !== publicStatusOf(change.to),
      createdAt: changedAt,
    });
  });
  return {
    tickets,
    ticketRelations,
    ticketNumberCounters: [...numbers].map(([projectId, lastNumber]) => ({
      projectId,
      lastNumber,
    })),
    activityEvents,
  };
}

/**
 * Loads the demo dataset; running it again restores the same records – also the tour progress,
 * so the newcomer sees the tours again, the demo projects with their members, the demo
 * organization with its domain, project access and members, the demo invitations – a link
 * resent, revoked or accepted during a demo comes back as it was – and the demo tickets with their
 * activity: tickets created during a demo in the demo projects are removed with their events and
 * attachments, as undoing an import removes tickets (§12.5).
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
    // Before the organization, which the tickets keep. Deleting a ticket removes its events.
    const projectIds = projects.map((project) => project.id ?? '');
    const demoTickets = {
      OR: [
        { projectId: { in: projectIds } },
        { organizationId: { in: organizations.map((organization) => organization.id ?? '') } },
      ],
    } satisfies Prisma.TicketWhereInput;
    // A ticket's original cannot be deleted while a relation points to it: relations first.
    await tx.ticketRelation.deleteMany({
      where: { OR: [{ sourceTicket: { is: demoTickets } }, { targetTicket: { is: demoTickets } }] },
    });
    // The attachments of the tickets restrict their deletion; their objects are removed by the
    // Worker's `attachment.deleted` job, as for every deleted attachment (S1-08).
    const attachments = await tx.attachment.findMany({
      where: { ticket: { is: demoTickets } },
      select: { id: true },
    });
    await tx.attachment.deleteMany({ where: { id: { in: attachments.map(({ id }) => id) } } });
    await tx.outboxEvent.createMany({
      data: attachments.map(({ id }) => ({
        type: ATTACHMENT_DELETED,
        payload: { attachmentId: id } satisfies AttachmentDeletedPayload,
      })),
    });
    await tx.ticket.deleteMany({ where: demoTickets });
    await tx.ticketNumberCounter.deleteMany({ where: { projectId: { in: projectIds } } });
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
    await tx.ticket.createMany({ data: dataset.tickets });
    await tx.ticketRelation.createMany({ data: dataset.ticketRelations });
    await tx.ticketNumberCounter.createMany({ data: dataset.ticketNumberCounters });
    await tx.activityEvent.createMany({ data: dataset.activityEvents });
  });
}
