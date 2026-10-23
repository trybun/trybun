// `pnpm db:seed` (§15.12): loads the demo dataset into the database of DATABASE_URL.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { readConfig } from '../src/platform/config/config.module.js';
import { seedDemoData } from './demo-dataset.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: readConfig().databaseUrl }),
});
try {
  await seedDemoData(prisma);
} finally {
  await prisma.$disconnect();
}
