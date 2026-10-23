import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { getEnv } from '../env/env.js';

export type { PrismaClient };

let client: PrismaClient | undefined;

/**
 * The database client of the web application, which uses only the sessions (§14.4); all other
 * data comes from the API. One client per process; it connects on the first query.
 */
export function getPrisma(): PrismaClient {
  client ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: getEnv().databaseUrl }),
  });
  return client;
}
