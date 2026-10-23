// The environment of integration tests: the database of the global set-up (§18.7). Call it before
// importing modules that read the environment.
import { inject, vi } from 'vitest';
import { TEST_ENV } from '../env.js';

export function stubIntegrationEnv(): void {
  for (const [name, value] of Object.entries(TEST_ENV)) {
    vi.stubEnv(name, value);
  }
  vi.stubEnv('DATABASE_URL', inject('databaseUrl'));
}
