/** A valid environment of the web application for tests (§15.3). */
export const TEST_ENV = {
  TRYBUN_DOMAIN: 'trybun.example.com',
  TRYBUN_API_URL: 'http://api:3001',
  DATABASE_URL: 'postgresql://trybun@localhost:5432/trybun',
  NEXTAUTH_URL: 'https://trybun.example.com',
  AUTH_SECRET: 'a-test-secret-of-at-least-32-characters',
  TRYBUN_KEYCLOAK_URL: 'http://keycloak:8080/auth',
  TRYBUN_KEYCLOAK_WEB_CLIENT_SECRET: 'web-client-secret',
};

/**
 * The optional variables of the web environment (src/lib/env/env.ts) that change its behaviour.
 * Tests unset them, so a root `.env` or the shell of the developer cannot leak into a test; a test
 * that needs one sets it itself.
 */
export const OPTIONAL_ENV_KEYS = [
  'TRYBUN_KEYCLOAK_PUBLIC_URL',
  'TRYBUN_DEFAULT_LANGUAGE',
  'TRYBUN_DEFAULT_TIME_ZONE',
  'TRYBUN_ATTACHMENT_MAX_SIZE_MB',
  'TRYBUN_MICROSOFT_CLIENT_ID',
  'TRYBUN_GOOGLE_CLIENT_ID',
] as const;
