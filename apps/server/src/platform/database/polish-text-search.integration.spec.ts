import { describe, expect, it } from 'vitest';
import { integrationConfig } from '../../../test/setup/config.js';
import { PrismaService } from './prisma.service.js';

describe('polish text search configuration', () => {
  it('stems Polish words after the migrations', async () => {
    const prisma = new PrismaService(integrationConfig());
    try {
      const [row] = await prisma.$queryRaw<{ lexemes: string }[]>`
        SELECT to_tsvector('polish', 'zgłoszeniami')::text AS lexemes
      `;
      expect(row?.lexemes).toContain("'zgłoszenie'");
    } finally {
      await prisma.$disconnect();
    }
  });
});
