import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { InvalidConfigError, loadConfig } from './load-config.js';

describe('loadConfig', () => {
  it('returns the typed configuration with defaults', () => {
    expect(loadConfig({ TRYBUN_DOMAIN: 'trybun.example.com' })).toEqual({
      domain: 'trybun.example.com',
      apiPort: 3001,
      workerHeartbeatFile: join(tmpdir(), 'trybun-worker.heartbeat'),
    });
  });

  it.each([
    [{}, 'TRYBUN_DOMAIN'],
    [{ TRYBUN_DOMAIN: 'not a host name' }, 'TRYBUN_DOMAIN'],
    [{ TRYBUN_DOMAIN: 'trybun.example.com', TRYBUN_API_PORT: '70000' }, 'TRYBUN_API_PORT'],
  ])('rejects %j naming %s', (env, variable) => {
    expect(() => loadConfig(env)).toThrow(InvalidConfigError);
    expect(() => loadConfig(env)).toThrow(new RegExp(`^Invalid configuration[^]*  ${variable}: `));
  });
});
