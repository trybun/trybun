import type { PrismaService } from '../database/prisma.service.js';

/** The cheapest query that needs a working connection to PostgreSQL. */
export async function selectOne(prisma: PrismaService): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
