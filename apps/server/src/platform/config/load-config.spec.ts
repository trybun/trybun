import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';
import { InvalidConfigError, loadConfig } from './load-config.js';

describe('loadConfig', () => {
  it('returns the typed configuration with defaults', () => {
    expect(loadConfig(TEST_ENV)).toEqual({
      domain: 'trybun.example.com',
      apiPort: 3001,
      databaseUrl: 'postgresql://trybun@localhost:5432/trybun',
      valkeyUrl: 'redis://localhost:6379',
      workerHeartbeatFile: join(tmpdir(), 'trybun-worker.heartbeat'),
    });
  });

  it.each([
    [{}, 'TRYBUN_DOMAIN'],
    [{ ...TEST_ENV, TRYBUN_DOMAIN: 'not a host name' }, 'TRYBUN_DOMAIN'],
    [{ ...TEST_ENV, TRYBUN_API_PORT: '70000' }, 'TRYBUN_API_PORT'],
    [{ ...TEST_ENV, DATABASE_URL: undefined }, 'DATABASE_URL'],
    [{ ...TEST_ENV, DATABASE_URL: 'mysql://localhost/trybun' }, 'DATABASE_URL'],
    [{ ...TEST_ENV, TRYBUN_VALKEY_URL: 'http://localhost:6379' }, 'TRYBUN_VALKEY_URL'],
  ])('rejects %j naming %s', (env, variable) => {
    expect(() => loadConfig(env)).toThrow(InvalidConfigError);
    expect(() => loadConfig(env)).toThrow(new RegExp(`^Invalid configuration[^]*  ${variable}: `));
  });
});
