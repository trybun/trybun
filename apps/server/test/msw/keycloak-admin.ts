// The Keycloak Admin API simulated with MSW (§18.7); the adapter itself is tested against a real
// Keycloak (platform/keycloak-admin).
import { randomUUID } from 'node:crypto';
import { http, HttpResponse } from 'msw';
import type { TrybunConfig } from '../../src/platform/config/config.schema.js';

export interface KeycloakAdminFake {
  handlers: ReturnType<typeof http.post>[];
  /** The bodies of the created users, by Keycloak user ID. */
  created: Map<string, Record<string, unknown>>;
  deleted: string[];
}

/**
 * Accepts every user it is asked to create, except a second user with the same e-mail address
 * (`409`, as Keycloak answers), and records deletions.
 */
export function keycloakAdminFake(config: TrybunConfig): KeycloakAdminFake {
  const created = new Map<string, Record<string, unknown>>();
  const deleted: string[] = [];
  const handlers = [
    http.post(config.keycloak.tokenUrl, () =>
      HttpResponse.json({ access_token: 'service-account-token', expires_in: 300 }),
    ),
    http.post(`${config.keycloak.adminUrl}/users`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      if ([...created.values()].some((user) => user.email === body.email)) {
        return HttpResponse.json({ errorMessage: 'User exists with same email' }, { status: 409 });
      }
      const id = randomUUID();
      created.set(id, body);
      return new HttpResponse(null, {
        status: 201,
        headers: { location: `${config.keycloak.adminUrl}/users/${id}` },
      });
    }),
    http.delete(`${config.keycloak.adminUrl}/users/:id`, ({ params }) => {
      const id = String(params.id);
      deleted.push(id);
      created.delete(id);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
  return { handlers, created, deleted };
}
