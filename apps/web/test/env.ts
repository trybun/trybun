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
