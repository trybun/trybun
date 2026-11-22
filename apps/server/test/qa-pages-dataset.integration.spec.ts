import { DEFAULT_PAGE_LIMIT } from '@trybun/contracts/pagination';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildDemoDataset, seedDemoData } from '../prisma/demo-dataset.js';
import {
  addQaPages,
  buildQaPagesDataset,
  qaPageId,
  removeQaPages,
} from '../prisma/qa-pages-dataset.js';
import { ATTACHMENT_DELETED } from '../src/modules/attachments/attachments.events.js';
import { PrismaService } from '../src/platform/database/prisma.service.js';
import { createAttachment } from './factories/attachment.factory.js';
import { createComment } from './factories/comment.factory.js';
import { createInvitation } from './factories/invitation.factory.js';
import { createProjectMember } from './factories/project-member.factory.js';
import { createDuplicateRelation, createTicket } from './factories/ticket.factory.js';
import { integrationConfig } from './setup/config.js';
import { createOwnDatabase } from './setup/own-database.js';

// The QA page records of the QA test environment (#440). A database of its own: "as it was before"
// compares every table, which the parallel tests of the shared database change.
describe('QA page records', () => {
  let prisma: PrismaService;
  const demo = buildDemoDataset();
  const manager = demo.users.find(({ email }) => email === 'manager@example.com');
  const customer = demo.users.find(({ email }) => email === 'customer@customer.example.com');
  const [demoProject] = demo.projects;
  const [demoTicket] = demo.tickets;
  const qaOrganizationId = qaPageId(101);
  const qaProjectId = qaPageId(201);

  beforeAll(async () => {
    prisma = new PrismaService({ ...integrationConfig(), databaseUrl: await createOwnDatabase() });
  });

  beforeEach(async () => {
    await removeQaPages(prisma);
    await seedDemoData(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Every row of every table but the outbox and `except`, as JSON text in a stable order. */
  async function snapshot(except: string[] = []) {
    const tables = await prisma.$queryRaw<{ name: string }[]>`
      SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('_prisma_migrations', 'outbox_events')
      ORDER BY table_name`;
    const rows: Record<string, string[]> = {};
    for (const { name } of tables.filter((table) => !except.includes(table.name))) {
      // The names come from the catalog above; identifiers cannot be query parameters.
      const result = await prisma.$queryRawUnsafe<{ row: string }[]>(
        `SELECT to_jsonb(t)::text AS row FROM "${name}" t ORDER BY 1`,
      );
      rows[name] = result.map(({ row }) => row);
    }
    return rows;
  }

  it('is the same on every build', () => {
    expect(buildQaPagesDataset()).toEqual(buildQaPagesDataset());
  });

  it('fills every list it names past one page', async () => {
    await addQaPages(prisma);

    const counts = {
      accounts: await prisma.user.count(),
      organizations: await prisma.organization.count({ where: { state: 'active' } }),
      projects: await prisma.project.count({ where: { state: 'active' } }),
      organizationMembers: await prisma.organizationMember.count({
        where: { organizationId: qaOrganizationId },
      }),
      organizationProjects: await prisma.organizationProject.count({
        where: { organizationId: qaOrganizationId },
      }),
      projectMembers: await prisma.projectMember.count({ where: { projectId: qaProjectId } }),
      projectOrganizations: await prisma.organizationProject.count({
        where: { projectId: qaProjectId },
      }),
      projectTickets: await prisma.ticket.count({ where: { projectId: qaProjectId } }),
      customersTickets: await prisma.ticket.count({ where: { requesterId: customer?.id } }),
    };
    for (const [list, count] of Object.entries(counts)) {
      expect({ list, secondPage: count > DEFAULT_PAGE_LIMIT }).toEqual({ list, secondPage: true });
    }
    // The requester has access to the project of her tickets, so the portal lists them.
    expect(
      await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: qaProjectId, userId: customer?.id ?? '' } },
        select: { role: true },
      }),
    ).toEqual({ role: 'end_user' });
  });

  it('keeps all but the tickets when a boot restores the demo dataset', async () => {
    await addQaPages(prisma);
    const added = await snapshot(['tickets']);

    await seedDemoData(prisma);

    expect(await snapshot(['tickets'])).toEqual(added);
    expect(await prisma.ticket.count({ where: { projectId: qaProjectId } })).toBe(0);
  });

  it('restores the records when added again', async () => {
    await addQaPages(prisma);
    const added = await snapshot();
    await prisma.organization.update({
      where: { id: qaOrganizationId },
      data: { name: 'Renamed during the QA' },
    });
    await prisma.projectMember.deleteMany({ where: { projectId: qaProjectId } });
    await createTicket(prisma, { projectId: qaProjectId, requesterId: manager?.id ?? '' });

    await addQaPages(prisma);

    expect(await snapshot()).toEqual(added);
  });

  it('leaves the database as it was before, also after records were added to them in the QA', async () => {
    const before = await snapshot();
    await addQaPages(prisma);
    const qaAccountId = qaPageId(1);
    // What a QA session may add to the QA page records.
    const ticket = await createTicket(prisma, {
      projectId: qaProjectId,
      requesterId: manager?.id ?? '',
    });
    const comment = await createComment(prisma, {
      ticketId: ticket.id,
      authorId: manager?.id ?? '',
    });
    const attachment = await createAttachment(prisma, {
      uploadedById: manager?.id ?? '',
      commentId: comment.id,
      status: 'available',
    });
    await createDuplicateRelation(prisma, ticket, { id: demoTicket?.id ?? '' });
    await createProjectMember(prisma, {
      projectId: demoProject?.id ?? '',
      userId: qaAccountId,
      role: 'end_user',
    });
    await createInvitation(prisma, { userId: qaAccountId, invitedById: manager?.id ?? null });

    await removeQaPages(prisma);

    expect(await snapshot()).toEqual(before);
    // The Worker removes the object of the deleted attachment, as after the demo dataset.
    expect(
      await prisma.outboxEvent.count({
        where: { type: ATTACHMENT_DELETED, payload: { equals: { attachmentId: attachment.id } } },
      }),
    ).toBe(1);
  });

  it('changes nothing when a record outside them refers to one of them', async () => {
    await addQaPages(prisma);
    const added = await snapshot();
    // A demo ticket marked as a duplicate of a QA page ticket.
    await createDuplicateRelation(prisma, { id: demoTicket?.id ?? '' }, { id: qaPageId(301) });
    const referred = await snapshot();

    await expect(removeQaPages(prisma)).rejects.toMatchObject({ code: 'P2003' });

    expect(await snapshot()).toEqual(referred);
    expect(referred).not.toEqual(added);
  });
});
