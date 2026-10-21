// Global set-up of the integration tests (§18.7): one PostgreSQL and one Valkey container per run.
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { ValkeyContainer } from '@testcontainers/valkey';
import type { TestProject } from 'vitest/node';

// Images pinned to a digest (§2.10). PostgreSQL is the base of the project image
// ghcr.io/trybun/postgres (§15.4), which replaces it once it is published.
const POSTGRES_IMAGE =
  'pgvector/pgvector:0.8.7-pg18-trixie@sha256:9d9c930220cb9bf2f956d10a8f909cf9973d9672ca0278aef2c1e6facccad2e0';
const VALKEY_IMAGE =
  'valkey/valkey:9.1.2-alpine3.24@sha256:48332870af354a799964c0012ae1194a0bf2bf894eb508f945810596dc2d8d11';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    valkeyUrl: string;
  }
}

export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, valkey] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).start(),
    new ValkeyContainer(VALKEY_IMAGE).start(),
  ]);
  project.provide('databaseUrl', postgres.getConnectionUri());
  project.provide('valkeyUrl', valkey.getConnectionUrl());

  return async () => {
    await Promise.all([postgres.stop(), valkey.stop()]);
  };
}
