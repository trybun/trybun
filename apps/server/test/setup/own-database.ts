// A database of its own for integration tests whose subject is the state of the whole system,
// e.g. the first-run wizard while no Administrator exists (§15.6): the other test files share
// one database and create accounts in parallel (§18.7).
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { inject } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { migrate } from './containers.js';

/** Creates and migrates a new database in the PostgreSQL container; returns its URL. */
export async function createOwnDatabase(): Promise<string> {
  const sharedUrl = inject('databaseUrl');
  const name = `test_${randomBytes(6).toString('hex')}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: sharedUrl }) });
  try {
    // The name is generated above; identifiers cannot be query parameters.
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await prisma.$disconnect();
  }
  const url = new URL(sharedUrl);
  url.pathname = `/${name}`;
  await migrate(url.href);
  return url.href;
}
