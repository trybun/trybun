import { describe, expect, it } from 'vitest';
import { buildDemoDataset, seedDemoData } from '../prisma/demo-dataset.js';
import { PrismaService } from '../src/platform/database/prisma.service.js';
import { integrationConfig } from './setup/config.js';

describe('demo dataset', () => {
  it('is the same on every build', () => {
    expect(buildDemoDataset()).toEqual(buildDemoDataset());
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
});
