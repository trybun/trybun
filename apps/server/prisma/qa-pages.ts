// `sh .ai/scripts/test-env-pages.sh add|remove` (#440): adds or removes the QA page records in
// the database of DATABASE_URL.
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import { readConfig } from '../src/platform/config/config.module.js';
import { addQaPages, QA_PAGE_COUNT, removeQaPages } from './qa-pages-dataset.js';

const action = process.argv[2];
if (action !== 'add' && action !== 'remove') {
  process.stderr.write('Usage: qa-pages.ts add|remove\n');
  process.exit(2);
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: readConfig().databaseUrl }),
});
try {
  if (action === 'add') {
    await addQaPages(prisma);
    process.stdout.write(`Added ${QA_PAGE_COUNT} QA page records of each kind.\n`);
  } else {
    await removeQaPages(prisma);
    process.stdout.write('Removed the QA page records.\n');
  }
} catch (error) {
  // P2003: a record outside the QA page records refers to one of them (see removeQaPageRecords).
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    process.stderr.write(
      `A record outside the QA page records refers to one of them; nothing was changed. Remove that reference, or start the test environment with --reset.\n${error.message}\n`,
    );
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await prisma.$disconnect();
}
