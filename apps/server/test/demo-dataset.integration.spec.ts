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
        orderBy: { userId: 'asc' },
      });
      expect(progress).toEqual(
        team
          .filter((user) => user !== newcomer)
          .map((user) => ({ userId: user.id, tourId: 'first_login', status: 'completed' })),
      );
    } finally {
      await prisma.$disconnect();
    }
  });
});
