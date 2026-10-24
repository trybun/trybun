// Keycloak with the realm configuration of the deployment package (docker/keycloak), for the
// integration tests of the sign-in (§15.5). Keycloak and keycloak-config-cli run in containers
// with the images of compose.yaml.
import { join } from 'node:path';
import {
  GenericContainer,
  type StartedNetwork,
  type StartedTestContainer,
  Wait,
} from 'testcontainers';

const KEYCLOAK_CONFIG_DIR = join(import.meta.dirname, '../../../../docker/keycloak');
// Pinned to the digests of compose.yaml (§2.10).
const KEYCLOAK_IMAGE =
  'quay.io/keycloak/keycloak:26.8.1@sha256:a78d6b79572168cb25886b80a8b5b8d4ed4390743e3eecb810538683e209dd6b';
const KEYCLOAK_CONFIG_CLI_IMAGE =
  'adorsys/keycloak-config-cli:6.5.1-26.5.5@sha256:0955d98c8a341898b7aa177477edf8a1e90569ae50bbe7598141c1270b773274';

const ADMIN_PASSWORD = 'admin';
export const WEB_CLIENT_SECRET = 'web-client-secret';
export const WEB_URL = 'http://localhost:3000';

export interface TestKeycloak {
  /** Base URL on the host, e.g. `http://localhost:32768/auth`. */
  url: string;
  container: StartedTestContainer;
}

export async function startKeycloak(network: StartedNetwork): Promise<TestKeycloak> {
  const container = await new GenericContainer(KEYCLOAK_IMAGE)
    .withNetwork(network)
    .withNetworkAliases('keycloak')
    .withCommand(['start-dev'])
    .withEnvironment({
      KC_HTTP_RELATIVE_PATH: '/auth',
      KC_HEALTH_ENABLED: 'true',
      KC_FEATURES_DISABLED: 'impersonation',
      KC_BOOTSTRAP_ADMIN_USERNAME: 'admin',
      KC_BOOTSTRAP_ADMIN_PASSWORD: ADMIN_PASSWORD,
    })
    // The login theme generated from the message catalogues, mounted as in compose.yaml.
    .withCopyDirectoriesToContainer([
      { source: join(KEYCLOAK_CONFIG_DIR, 'themes/trybun'), target: '/opt/keycloak/themes/trybun' },
    ])
    .withExposedPorts(8080, 9000)
    .withWaitStrategy(Wait.forHttp('/auth/health/ready', 9000).withStartupTimeout(180_000))
    .start();
  return {
    url: `http://${container.getHost()}:${container.getMappedPort(8080)}/auth`,
    container,
  };
}

/** Runs the `keycloak-config` service of compose.yaml once with the given variables. */
export async function applyRealmConfig(
  network: StartedNetwork,
  env: Record<string, string> = {},
): Promise<void> {
  const container = await new GenericContainer(KEYCLOAK_CONFIG_CLI_IMAGE)
    .withNetwork(network)
    .withCopyDirectoriesToContainer([
      { source: join(KEYCLOAK_CONFIG_DIR, 'realm'), target: '/config/realm' },
    ])
    .withCopyFilesToContainer([
      { source: join(KEYCLOAK_CONFIG_DIR, 'apply-config.sh'), target: '/config/apply-config.sh' },
    ])
    .withEntrypoint(['sh', '/config/apply-config.sh'])
    .withEnvironment({
      KEYCLOAK_URL: 'http://keycloak:8080/auth',
      KEYCLOAK_USER: 'admin',
      KEYCLOAK_PASSWORD: ADMIN_PASSWORD,
      TRYBUN_DOMAIN: 'trybun.example.com',
      TRYBUN_WEB_URL: WEB_URL,
      TRYBUN_KEYCLOAK_WEB_CLIENT_SECRET: WEB_CLIENT_SECRET,
      TRYBUN_KEYCLOAK_SERVER_CLIENT_SECRET: 'server-client-secret',
      ...env,
    })
    .withWaitStrategy(Wait.forOneShotStartup())
    .withStartupTimeout(180_000)
    .start();
  await container.stop();
}

/** A client of the Keycloak Admin REST API with the bootstrap administrator. */
export async function adminApi(keycloak: TestKeycloak) {
  const response = await fetch(`${keycloak.url}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: 'admin',
      password: ADMIN_PASSWORD,
    }),
  });
  const { access_token: token } = (await response.json()) as { access_token: string };
  return async <T = unknown>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${keycloak.url}/admin/realms/trybun${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
    }
    const text = await res.text();
    return (text === '' ? undefined : JSON.parse(text)) as T;
  };
}
