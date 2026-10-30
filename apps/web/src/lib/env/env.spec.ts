import { describe, expect, it, vi } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';

vi.mock('server-only', () => ({}));

const { InvalidEnvError, parseEnv } = await import('./env.js');

describe('parseEnv', () => {
  it('returns the typed environment', () => {
    expect(parseEnv(TEST_ENV)).toEqual({
      domain: 'trybun.example.com',
      apiUrl: 'http://api:3001',
      databaseUrl: 'postgresql://trybun@localhost:5432/trybun',
      authSecret: 'a-test-secret-of-at-least-32-characters',
      origin: 'https://trybun.example.com',
      shouldUseSecureCookies: true,
      defaultLanguage: 'en',
      defaultTimeZone: 'UTC',
      isDevelopment: false,
      endUserIdentityProviders: [],
      keycloak: {
        issuer: 'https://trybun.example.com/auth/realms/trybun',
        internalRealmUrl: 'http://keycloak:8080/auth/realms/trybun',
        clientId: 'trybun-web',
        clientSecret: 'web-client-secret',
      },
    });
  });

  it('lists the configured sign-in providers of end users', () => {
    expect(
      parseEnv({ ...TEST_ENV, TRYBUN_MICROSOFT_CLIENT_ID: 'id', TRYBUN_GOOGLE_CLIENT_ID: 'id' })
        .endUserIdentityProviders,
    ).toEqual(['microsoft', 'google']);
    expect(
      parseEnv({ ...TEST_ENV, TRYBUN_MICROSOFT_CLIENT_ID: '', TRYBUN_GOOGLE_CLIENT_ID: 'id' })
        .endUserIdentityProviders,
    ).toEqual(['google']);
  });

  it('recognizes `next dev`', () => {
    expect(parseEnv({ ...TEST_ENV, NODE_ENV: 'development' }).isDevelopment).toBe(true);
  });

  it('takes the issuer from the public URL of Keycloak when it is set', () => {
    const env = parseEnv({ ...TEST_ENV, TRYBUN_KEYCLOAK_PUBLIC_URL: 'http://localhost:8080/auth' });

    expect(env.keycloak.issuer).toBe('http://localhost:8080/auth/realms/trybun');
  });

  it('takes the system default language and time zone', () => {
    const env = parseEnv({
      ...TEST_ENV,
      NEXTAUTH_URL: 'http://localhost:3000',
      TRYBUN_DEFAULT_LANGUAGE: 'pl',
      TRYBUN_DEFAULT_TIME_ZONE: 'Europe/Warsaw',
    });

    expect(env).toMatchObject({
      origin: 'http://localhost:3000',
      shouldUseSecureCookies: false,
      defaultLanguage: 'pl',
      defaultTimeZone: 'Europe/Warsaw',
    });
  });

  it.each([
    [{ ...TEST_ENV, TRYBUN_DOMAIN: undefined }, 'TRYBUN_DOMAIN'],
    [{ ...TEST_ENV, TRYBUN_API_URL: undefined }, 'TRYBUN_API_URL'],
    [{ ...TEST_ENV, TRYBUN_API_URL: 'ftp://api' }, 'TRYBUN_API_URL'],
    [{ ...TEST_ENV, DATABASE_URL: 'mysql://localhost/trybun' }, 'DATABASE_URL'],
    [{ ...TEST_ENV, NEXTAUTH_URL: undefined }, 'NEXTAUTH_URL'],
    [{ ...TEST_ENV, AUTH_SECRET: 'too short' }, 'AUTH_SECRET'],
    [{ ...TEST_ENV, TRYBUN_KEYCLOAK_URL: undefined }, 'TRYBUN_KEYCLOAK_URL'],
    [{ ...TEST_ENV, TRYBUN_KEYCLOAK_WEB_CLIENT_SECRET: '' }, 'TRYBUN_KEYCLOAK_WEB_CLIENT_SECRET'],
    [{ ...TEST_ENV, TRYBUN_DEFAULT_LANGUAGE: 'de' }, 'TRYBUN_DEFAULT_LANGUAGE'],
    [{ ...TEST_ENV, TRYBUN_DEFAULT_TIME_ZONE: 'Europe/Nowhere' }, 'TRYBUN_DEFAULT_TIME_ZONE'],
  ])('rejects %j naming %s', (env, variable) => {
    expect(() => parseEnv(env)).toThrow(InvalidEnvError);
    expect(() => parseEnv(env)).toThrow(new RegExp(`^Invalid configuration[^]*  ${variable}: `));
  });
});
