// Global set-up of the integration tests (§18.7): one PostgreSQL and one Valkey container per run;
// the migrations are applied once, as the one-off `migrate` service does (§15.7).
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { ValkeyContainer } from '@testcontainers/valkey';
import { GenericContainer } from 'testcontainers';
import type { TestProject } from 'vitest/node';

const SERVER_DIR = join(import.meta.dirname, '../..');
// The project image ghcr.io/trybun/postgres (pgvector, Polish dictionary, §14.4), built from its
// Dockerfile; its base image is pinned to a digest there (§2.10).
const POSTGRES_DOCKERFILE_DIR = join(SERVER_DIR, '../../docker/postgres');
const POSTGRES_IMAGE = 'trybun-postgres-test';
// Pinned to a digest (§2.10).
const VALKEY_IMAGE =
  'valkey/valkey:9.1.2-alpine3.24@sha256:48332870af354a799964c0012ae1194a0bf2bf894eb508f945810596dc2d8d11';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    valkeyUrl: string;
  }
}

async function migrate(databaseUrl: string): Promise<void> {
  await promisify(execFile)(join(SERVER_DIR, 'node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

export async function setup(project: TestProject): Promise<() => Promise<void>> {
  await GenericContainer.fromDockerfile(POSTGRES_DOCKERFILE_DIR).build(POSTGRES_IMAGE, {
    deleteOnExit: false,
  });
  const [postgres, valkey] = await Promise.all([
    // The image creates the Keycloak database at initialization (§15.5).
    new PostgreSqlContainer(POSTGRES_IMAGE)
      .withEnvironment({ KEYCLOAK_DB_PASSWORD: 'keycloak' })
      .start(),
    new ValkeyContainer(VALKEY_IMAGE).start(),
  ]);
  await migrate(postgres.getConnectionUri());
  project.provide('databaseUrl', postgres.getConnectionUri());
  project.provide('valkeyUrl', valkey.getConnectionUrl());

  return async () => {
    await Promise.all([postgres.stop(), valkey.stop()]);
  };
}
