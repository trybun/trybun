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
      keycloak: {
        issuer: 'https://trybun.example.com/auth/realms/trybun',
        jwksUrl: 'http://keycloak:8080/auth/realms/trybun/protocol/openid-connect/certs',
        tokenUrl: 'http://keycloak:8080/auth/realms/trybun/protocol/openid-connect/token',
        adminUrl: 'http://keycloak:8080/auth/admin/realms/trybun',
        serverClientSecret: 'server-client-secret',
      },
      isGithubSignInConfigured: false,
      isSmtpConfigured: false,
      isBackupStorageConfigured: false,
      defaultLanguage: 'en',
      defaultTimeZone: 'UTC',
      rateLimits: { user: 100, ip: 20 },
      logLevel: 'silent',
      workerHeartbeatFile: join(tmpdir(), 'trybun-worker.heartbeat'),
    });
  });

  it('logs at the info level by default', () => {
    expect(loadConfig({ ...TEST_ENV, TRYBUN_LOG_LEVEL: undefined }).logLevel).toBe('info');
  });

  it('takes the system default language and time zone', () => {
    const config = loadConfig({
      ...TEST_ENV,
      TRYBUN_DEFAULT_LANGUAGE: 'pl',
      TRYBUN_DEFAULT_TIME_ZONE: 'Europe/Warsaw',
    });

    expect(config).toMatchObject({ defaultLanguage: 'pl', defaultTimeZone: 'Europe/Warsaw' });
  });

  it.each([
    [{ TRYBUN_GITHUB_CLIENT_ID: 'id', TRYBUN_GITHUB_CLIENT_SECRET: 'secret' }, true],
    [{ TRYBUN_GITHUB_CLIENT_ID: 'id' }, false],
    [{ TRYBUN_GITHUB_CLIENT_ID: 'id', TRYBUN_GITHUB_CLIENT_SECRET: '' }, false],
  ])('GitHub sign-in with %j is configured: %s', (env, isConfigured) => {
    expect(loadConfig({ ...TEST_ENV, ...env }).isGithubSignInConfigured).toBe(isConfigured);
  });

  it.each([
    [{ TRYBUN_SMTP_HOST: 'smtp.example.com', TRYBUN_MAIL_FROM: 'trybun@example.com' }, true],
    [{ TRYBUN_SMTP_HOST: '' }, false],
    [{}, false],
  ])('SMTP with %j is configured: %s', (env, isConfigured) => {
    expect(loadConfig({ ...TEST_ENV, ...env }).isSmtpConfigured).toBe(isConfigured);
  });

  it.each([
    [{ TRYBUN_BACKUP_S3_URL: 'https://s3.example.com/backups' }, true],
    [{ TRYBUN_BACKUP_S3_URL: '' }, false],
    [{}, false],
  ])('the backup storage with %j is configured: %s', (env, isConfigured) => {
    expect(loadConfig({ ...TEST_ENV, ...env }).isBackupStorageConfigured).toBe(isConfigured);
  });

  it('takes the issuer from the public URL of Keycloak when it is set', () => {
    const config = loadConfig({
      ...TEST_ENV,
      TRYBUN_KEYCLOAK_PUBLIC_URL: 'http://localhost:8080/auth',
    });

    expect(config.keycloak.issuer).toBe('http://localhost:8080/auth/realms/trybun');
  });

  it.each([
    [{}, 'TRYBUN_DOMAIN'],
    [{ ...TEST_ENV, TRYBUN_DOMAIN: 'not a host name' }, 'TRYBUN_DOMAIN'],
    [{ ...TEST_ENV, TRYBUN_API_PORT: '70000' }, 'TRYBUN_API_PORT'],
    [{ ...TEST_ENV, DATABASE_URL: undefined }, 'DATABASE_URL'],
    [{ ...TEST_ENV, DATABASE_URL: 'mysql://localhost/trybun' }, 'DATABASE_URL'],
    [{ ...TEST_ENV, TRYBUN_VALKEY_URL: 'http://localhost:6379' }, 'TRYBUN_VALKEY_URL'],
    [{ ...TEST_ENV, TRYBUN_KEYCLOAK_URL: undefined }, 'TRYBUN_KEYCLOAK_URL'],
    [{ ...TEST_ENV, TRYBUN_KEYCLOAK_PUBLIC_URL: 'keycloak' }, 'TRYBUN_KEYCLOAK_PUBLIC_URL'],
    [{ ...TEST_ENV, TRYBUN_DEFAULT_LANGUAGE: 'de' }, 'TRYBUN_DEFAULT_LANGUAGE'],
    [{ ...TEST_ENV, TRYBUN_DEFAULT_TIME_ZONE: 'Mars/Olympus' }, 'TRYBUN_DEFAULT_TIME_ZONE'],
    [{ ...TEST_ENV, TRYBUN_LOG_LEVEL: 'verbose' }, 'TRYBUN_LOG_LEVEL'],
    [
      { ...TEST_ENV, TRYBUN_KEYCLOAK_SERVER_CLIENT_SECRET: undefined },
      'TRYBUN_KEYCLOAK_SERVER_CLIENT_SECRET',
    ],
    [{ ...TEST_ENV, TRYBUN_SMTP_HOST: 'smtp.example.com' }, 'TRYBUN_MAIL_FROM'],
  ])('rejects %j naming %s', (env, variable) => {
    expect(() => loadConfig(env)).toThrow(InvalidConfigError);
    expect(() => loadConfig(env)).toThrow(new RegExp(`^Invalid configuration[^]*  ${variable}: `));
  });
});
