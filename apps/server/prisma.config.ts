import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma ORM 7 does not load `.env`; the local environment keeps it in the repository root
// (§15.12). Containers get their variables from Compose.
const ENV_FILE = new URL('../../.env', import.meta.url);
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // `prisma generate` needs no database (install, CI, image build); the migration commands
  // report the missing variable themselves.
  datasource: databaseUrl === undefined ? undefined : { url: databaseUrl },
});
