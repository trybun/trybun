import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { InvalidEnvError, parseEnv } = await import('./env.js');

describe('parseEnv', () => {
  it('returns the typed environment', () => {
    expect(
      parseEnv({ TRYBUN_DOMAIN: 'trybun.example.com', TRYBUN_API_URL: 'http://api:3001' }),
    ).toEqual({ domain: 'trybun.example.com', apiUrl: 'http://api:3001' });
  });

  it.each([
    [{ TRYBUN_API_URL: 'http://api:3001' }, 'TRYBUN_DOMAIN'],
    [{ TRYBUN_DOMAIN: 'trybun.example.com' }, 'TRYBUN_API_URL'],
    [{ TRYBUN_DOMAIN: 'trybun.example.com', TRYBUN_API_URL: 'ftp://api' }, 'TRYBUN_API_URL'],
  ])('rejects %j naming %s', (env, variable) => {
    expect(() => parseEnv(env)).toThrow(InvalidEnvError);
    expect(() => parseEnv(env)).toThrow(new RegExp(`^Invalid configuration[^]*  ${variable}: `));
  });
});
