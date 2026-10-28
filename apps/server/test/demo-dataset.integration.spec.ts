import { productTourIdSchema } from '@trybun/contracts/product-tours';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDemoDataset, NEWCOMER_EMAIL, seedDemoData } from '../prisma/demo-dataset.js';
import { PrismaService } from '../src/platform/database/prisma.service.js';
import { integrationConfig } from './setup/config.js';

describe('demo dataset', () => {
  it('is the same on every build', () => {
    expect(buildDemoDataset()).toEqual(buildDemoDataset());
  });

  it('links every team account to the seeded Keycloak user with the same ID and e-mail', async () => {
    const realm = JSON.parse(
      await readFile(
        join(import.meta.dirname, '../../../docker/keycloak/dev/trybun-realm.json'),
        'utf8',
      ),
    ) as { users: { id: string; email: string }[] };
    const team = buildDemoDataset().users.filter((user) => user.kind === 'team');

    expect(team.map(({ keycloakUserId, email }) => ({ id: keycloakUserId, email }))).toEqual(
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
        domains: organizationDomains.map(({ domain }) => ({ domain })),
        _count: { projects: organizationProjects.length, members: organizationMembers.length },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('restores the tour progress: none for the newcomer, completed for the other team accounts', async () => {
    const prisma = new PrismaService(integrationConfig());
    const team = buildDemoDataset().users.filter((user) => user.kind === 'team');
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
