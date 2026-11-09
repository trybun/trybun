import { productTourIdSchema } from '@trybun/contracts/product-tours';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDemoDataset, NEWCOMER_EMAIL, seedDemoData } from '../prisma/demo-dataset.js';
import { PrismaService } from '../src/platform/database/prisma.service.js';
import { createAttachment } from './factories/attachment.factory.js';
import { integrationConfig } from './setup/config.js';

describe('demo dataset', () => {
  it('is the same on every build', () => {
    expect(buildDemoDataset()).toEqual(buildDemoDataset());
  });

  it('links every account that signs in to the seeded Keycloak user with the same ID and e-mail', async () => {
    const realm = JSON.parse(
      await readFile(
        join(import.meta.dirname, '../../../docker/keycloak/dev/trybun-realm.json'),
        'utf8',
      ),
    ) as { users: { id: string; email: string }[] };
    // The team accounts and the end users of the portal (S1-09); the invited accounts have no
    // Keycloak user until they accept (§7.4), and the other demo end users never sign in.
    const signingIn = buildDemoDataset().users.filter(
      (user) => user.keycloakUserId !== undefined && user.keycloakUserId !== null,
    );

    expect(signingIn.map(({ keycloakUserId, email }) => ({ id: keycloakUserId, email }))).toEqual(
      realm.users.map(({ id, email }) => ({ id, email })),
    );
  });

  it('loads identical records on two runs', async () => {
    const prisma = new PrismaService(integrationConfig());
    const ids = buildDemoDataset().users.map((user) => user.id ?? '');
    const load = async () => {
      await seedDemoData(prisma);
      return prisma.user.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
    };
    try {
      const first = await load();
      const second = await load();

      expect(first).toHaveLength(ids.length);
      expect(second).toEqual(first);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('restores the demo projects with their members on a second run', async () => {
    const prisma = new PrismaService(integrationConfig());
    const { projects, projectMembers } = buildDemoDataset();
    const [project] = projects;
    try {
      await seedDemoData(prisma);
      await prisma.project.update({
        where: { id: project?.id },
        data: { state: 'archived', version: { increment: 1 } },
      });
      await prisma.projectMember.deleteMany({ where: { projectId: project?.id } });
      await seedDemoData(prisma);

      const ids = projects.map(({ id }) => id ?? '');
      expect(
        await prisma.project.findMany({
          where: { id: { in: ids } },
          select: { key: true, state: true, version: true },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(projects.map(({ key, state }) => ({ key, state, version: 1 })));
      expect(await prisma.projectMember.count({ where: { projectId: { in: ids } } })).toBe(
        projectMembers.length,
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  it('restores the demo organization with its domain, access and members on a second run', async () => {
    const prisma = new PrismaService(integrationConfig());
    const { organizations, organizationDomains, organizationProjects, organizationMembers } =
      buildDemoDataset();
    const organizationId = organizations[0]?.id ?? '';
    try {
      await seedDemoData(prisma);
      await prisma.organization.update({
        where: { id: organizationId },
        data: { state: 'archived', version: { increment: 1 } },
      });
      await prisma.organizationMember.deleteMany({ where: { organizationId } });
      await prisma.organizationDomain.deleteMany({ where: { organizationId } });
      await seedDemoData(prisma);

      expect(
        await prisma.organization.findUnique({
          where: { id: organizationId },
          select: {
            state: true,
            version: true,
            domains: { select: { domain: true } },
            _count: { select: { projects: true, members: true } },
          },
        }),
      ).toEqual({
        state: 'active',
        version: 1,
        domains: organizationDomains
          .filter((domain) => domain.organizationId === organizationId)
          .map(({ domain }) => ({ domain })),
        _count: {
          projects: organizationProjects.filter(
            (access) => access.organizationId === organizationId,
          ).length,
          members: organizationMembers.filter((member) => member.organizationId === organizationId)
            .length,
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('restores the demo tickets, their numbers and their events on a second run', async () => {
    const prisma = new PrismaService(integrationConfig());
    const { projects, tickets, ticketNumberCounters, activityEvents } = buildDemoDataset();
    const projectIds = projects.map(({ id }) => id ?? '');
    const state = async () => ({
      tickets: await prisma.ticket.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true, number: true, title: true, assigneeId: true, version: true },
        orderBy: { id: 'asc' },
      }),
      counters: await prisma.ticketNumberCounter.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: { projectId: 'asc' },
      }),
      events: await prisma.activityEvent.count({
        where: { ticket: { projectId: { in: projectIds } } },
      }),
    });
    try {
      await seedDemoData(prisma);
      const seeded = await state();
      const [first] = tickets;
      await prisma.ticket.update({
        where: { id: first?.id },
        data: { title: 'Changed in a demo', version: { increment: 1 } },
      });
      const created = await prisma.ticket.create({
        data: {
          projectId: first?.projectId ?? '',
          number: 99,
          title: 'Created in a demo',
          source: 'developer',
          status: 'todo',
          requesterId: first?.requesterId ?? '',
        },
      });
      // A file attached during a demo restricts the deletion of its ticket (S1-08).
      const attachment = await createAttachment(prisma, {
        uploadedById: first?.requesterId ?? '',
        ticketId: created.id,
      });
      await seedDemoData(prisma);

      expect(await state()).toEqual(seeded);
      expect(await prisma.attachment.count({ where: { id: attachment.id } })).toBe(0);
      // Its objects are removed by the job of `attachment.deleted`.
      expect(
        await prisma.outboxEvent.count({
          where: {
            type: 'attachment.deleted',
            payload: { equals: { attachmentId: attachment.id } },
          },
        }),
      ).toBe(1);
      expect(seeded.tickets).toHaveLength(tickets.length);
      expect(seeded.counters).toHaveLength(ticketNumberCounters.length);
      expect(seeded.events).toBe(activityEvents.length);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('restores the pending and the expired invitation and the deactivated account on a second run', async () => {
    const prisma = new PrismaService(integrationConfig());
    const { users, invitations } = buildDemoDataset();
    const ids = invitations.map(({ id }) => id ?? '');
    const deactivated = users.find((user) => user.state === 'deactivated');
    const states = () =>
      prisma.invitation.findMany({
        where: { id: { in: ids } },
        select: { tokenHash: true, usedAt: true, revokedAt: true, expiresAt: true },
        orderBy: { id: 'asc' },
      });
    try {
      await seedDemoData(prisma);
      const seeded = await states();
      await prisma.invitation.update({ where: { id: ids[0] }, data: { revokedAt: new Date() } });
      await prisma.invitation.delete({ where: { id: ids[1] } });
      await prisma.user.update({ where: { id: deactivated?.id }, data: { state: 'active' } });
      await seedDemoData(prisma);

      expect(await states()).toEqual(seeded);
      const [pending, expired] = seeded;
      expect(pending).toMatchObject({ usedAt: null, revokedAt: null });
      expect(pending?.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(expired).toMatchObject({ usedAt: null, revokedAt: null });
      expect(expired?.expiresAt.getTime()).toBeLessThan(Date.now());
      expect(
        await prisma.user.findUnique({ where: { id: deactivated?.id }, select: { state: true } }),
      ).toEqual({ state: 'deactivated' });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('restores the tour progress: none for the newcomer, completed for the other team accounts', async () => {
    const prisma = new PrismaService(integrationConfig());
    // The invited team account has never signed in, so it has no tour progress.
    const team = buildDemoDataset().users.filter(
      (user) => user.kind === 'team' && user.state === 'active',
    );
    const newcomer = team.find((user) => user.email === NEWCOMER_EMAIL);
    try {
      await seedDemoData(prisma);
      await prisma.productTourProgress.create({
        data: {
          userId: newcomer?.id ?? '',
          tourId: 'first_login',
          tourVersion: 1,
          status: 'skipped',
        },
      });
      await seedDemoData(prisma);

      const progress = await prisma.productTourProgress.findMany({
        where: { userId: { in: team.map((user) => user.id ?? '') } },
        select: { userId: true, tourId: true, status: true },
        orderBy: [{ userId: 'asc' }, { tourId: 'asc' }],
      });
      expect(progress).toEqual(
        team
          .filter((user) => user !== newcomer)
          .flatMap((user) =>
            [...productTourIdSchema.options]
              .sort()
              .map((tourId) => ({ userId: user.id, tourId, status: 'completed' })),
          ),
      );
    } finally {
      await prisma.$disconnect();
    }
  });
});
