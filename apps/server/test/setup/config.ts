// Configuration of integration tests: the containers of the global set-up (§18.7).
import { inject } from 'vitest';
import type { TrybunConfig } from '../../src/platform/config/config.schema.js';
import { loadConfig } from '../../src/platform/config/load-config.js';
import { TEST_ENV } from '../env.js';

export function integrationConfig(): TrybunConfig {
  return loadConfig({
    ...TEST_ENV,
    DATABASE_URL: inject('databaseUrl'),
    TRYBUN_VALKEY_URL: inject('valkeyUrl'),
  });
}
