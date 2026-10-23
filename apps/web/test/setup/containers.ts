// Global set-up of the integration tests (§18.7): one PostgreSQL container per run with the
// migrations of apps/server, which owns the schema of the sessions (§14.4).
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';
import type { TestProject } from 'vitest/node';

const WEB_DIR = join(import.meta.dirname, '../..');
// The project image ghcr.io/trybun/postgres, built from its Dockerfile (§14.4); the migrations
// need its Polish dictionary.
const POSTGRES_DOCKERFILE_DIR = join(WEB_DIR, '../../docker/postgres');
const POSTGRES_IMAGE = 'trybun-postgres-test';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

async function migrate(databaseUrl: string): Promise<void> {
  await promisify(execFile)(
    join(WEB_DIR, 'node_modules/.bin/prisma'),
    ['migrate', 'deploy', '--config', '../server/prisma.config.ts'],
    { cwd: WEB_DIR, env: { ...process.env, DATABASE_URL: databaseUrl } },
  );
}

export async function setup(project: TestProject): Promise<() => Promise<void>> {
  await GenericContainer.fromDockerfile(POSTGRES_DOCKERFILE_DIR).build(POSTGRES_IMAGE, {
    deleteOnExit: false,
  });
  // The image creates the Keycloak database at initialization (§15.5).
  const postgres = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withEnvironment({ KEYCLOAK_DB_PASSWORD: 'keycloak' })
    .start();
  await migrate(postgres.getConnectionUri());
  project.provide('databaseUrl', postgres.getConnectionUri());

  return async () => {
    await postgres.stop();
  };
}
