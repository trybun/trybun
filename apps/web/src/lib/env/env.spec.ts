import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPTIONAL_ENV_KEYS, TEST_ENV } from '../../../test/env.js';
import { stubIntegrationEnv } from '../../../test/setup/environment.js';

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
      attachmentMaxSizeMb: 25,
      isDevelopment: false,
      isPseudoLocaleEnabled: false,
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

  describe('the pseudo-locale of the tests (§13.1)', () => {
    const LOCAL = { ...TEST_ENV, NEXTAUTH_URL: 'http://localhost:3000' };

    it('is off by default, also on a loopback address', () => {
      expect(parseEnv(LOCAL).isPseudoLocaleEnabled).toBe(false);
    });

    it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000'])(
      'is switched on by TRYBUN_PSEUDO_LOCALE on %s',
      (url) => {
        expect(
          parseEnv({ ...TEST_ENV, NEXTAUTH_URL: url, TRYBUN_PSEUDO_LOCALE: 'true' })
            .isPseudoLocaleEnabled,
        ).toBe(true);
      },
    );

    it('is on under `next dev`', () => {
      expect(parseEnv({ ...LOCAL, NODE_ENV: 'development' }).isPseudoLocaleEnabled).toBe(true);
    });

    it('stops the start-up when switched on outside a loopback address', () => {
      expect(() => parseEnv({ ...TEST_ENV, TRYBUN_PSEUDO_LOCALE: 'true' })).toThrow(
        /TRYBUN_PSEUDO_LOCALE: The pseudo-locale is for tests only/,
      );
    });

    it('reports an invalid NEXTAUTH_URL with the other variables instead of throwing', () => {
      expect(() =>
        parseEnv({ ...TEST_ENV, NEXTAUTH_URL: 'localhost:3000', TRYBUN_PSEUDO_LOCALE: 'yes' }),
      ).toThrow(InvalidEnvError);
    });

    it('accepts only true or false', () => {
      expect(() => parseEnv({ ...LOCAL, TRYBUN_PSEUDO_LOCALE: 'yes' })).toThrow(InvalidEnvError);
    });

    // The production container gets an explicit list of variables, so the switch never reaches
    // an installation through Compose or the image.
    it.each(['compose.yaml', 'docker/web/Dockerfile'])('is never set by %s', (file) => {
      const content = readFileSync(join(import.meta.dirname, '../../../../..', file), 'utf8');
      expect(content).not.toContain('TRYBUN_PSEUDO_LOCALE');
    });
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

  it('takes the maximum attachment size', () => {
    expect(
      parseEnv({ ...TEST_ENV, TRYBUN_ATTACHMENT_MAX_SIZE_MB: '100' }).attachmentMaxSizeMb,
    ).toBe(100);
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
    [{ ...TEST_ENV, TRYBUN_ATTACHMENT_MAX_SIZE_MB: '0' }, 'TRYBUN_ATTACHMENT_MAX_SIZE_MB'],
    [{ ...TEST_ENV, TRYBUN_ATTACHMENT_MAX_SIZE_MB: '101' }, 'TRYBUN_ATTACHMENT_MAX_SIZE_MB'],
  ])('rejects %j naming %s', (env, variable) => {
    expect(() => parseEnv(env)).toThrow(InvalidEnvError);
    expect(() => parseEnv(env)).toThrow(new RegExp(`^Invalid configuration[^]*  ${variable}: `));
  });
});

describe('stubIntegrationEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('unsets the optional variables of the process, e.g. from a root .env', () => {
    for (const name of OPTIONAL_ENV_KEYS) {
      vi.stubEnv(name, name === 'TRYBUN_KEYCLOAK_PUBLIC_URL' ? 'http://localhost:8080/auth' : 'x');
    }

    stubIntegrationEnv();

    for (const name of OPTIONAL_ENV_KEYS) {
      expect(process.env[name]).toBeUndefined();
    }
    expect(parseEnv({ ...process.env, DATABASE_URL: TEST_ENV.DATABASE_URL }).keycloak.issuer).toBe(
      'https://trybun.example.com/auth/realms/trybun',
    );
  });
});
