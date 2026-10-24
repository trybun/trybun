/** A valid environment for tests that start a module without real databases (§15.3). */
export const TEST_ENV = {
  TRYBUN_DOMAIN: 'trybun.example.com',
  DATABASE_URL: 'postgresql://trybun@localhost:5432/trybun',
  TRYBUN_VALKEY_URL: 'redis://localhost:6379',
  TRYBUN_KEYCLOAK_URL: 'http://keycloak:8080/auth',
  // Tests that check log lines set their own level.
  TRYBUN_LOG_LEVEL: 'silent',
};
