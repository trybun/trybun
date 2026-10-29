// The Keycloak Admin API simulated with MSW (§18.7); the adapter itself is tested against a real
// Keycloak (platform/keycloak-admin).
import { randomUUID } from 'node:crypto';
import { http, HttpResponse } from 'msw';
import type { TrybunConfig } from '../../src/platform/config/config.schema.js';

/** The ID of the group `team` in the fake. */
const TEAM_GROUP_ID = 'team-group-id';

export interface KeycloakAdminFake {
  handlers: ReturnType<typeof http.post>[];
  /** The users by Keycloak user ID: the bodies of created users, or users added by a test. */
  created: Map<string, Record<string, unknown>>;
  deleted: string[];
  /** The users added to the group `team`. */
  teamMembers: Set<string>;
  /** The linked provider accounts of a user, e.g. `{ github: 'octocat' }`. */
  federatedIdentities: Map<string, Record<string, string>>;
  /** Runs after a user is created and before the response is sent, e.g. to interleave a change. */
  afterCreate: (() => Promise<void>) | null;
  /** Adds a user as a sign-in through an identity provider creates it; returns its ID. */
  addUser(user: Record<string, unknown>, identities?: Record<string, string>): string;
}

/**
 * Accepts every user it is asked to create, except a second user with the same e-mail address
 * (`409`, as Keycloak answers), and records deletions, changes and group memberships.
 */
export function keycloakAdminFake(config: TrybunConfig): KeycloakAdminFake {
  const fake: KeycloakAdminFake = {
    handlers: [],
    created: new Map(),
    deleted: [],
    teamMembers: new Set(),
    federatedIdentities: new Map(),
    afterCreate: null,
    addUser(user, identities = {}) {
      const id = randomUUID();
      fake.created.set(id, { createdTimestamp: Date.now(), ...user });
      fake.federatedIdentities.set(id, identities);
      return id;
    },
  };
  const isEmailTaken = (email: unknown, exceptId?: string): boolean =>
    [...fake.created].some(([id, user]) => id !== exceptId && user.email === email);
  const users = `${config.keycloak.adminUrl}/users`;
  fake.handlers = [
    http.post(config.keycloak.tokenUrl, () =>
      HttpResponse.json({ access_token: 'service-account-token', expires_in: 300 }),
    ),
    http.post(users, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      if (isEmailTaken(body.email)) {
        return HttpResponse.json({ errorMessage: 'User exists with same email' }, { status: 409 });
      }
      const id = randomUUID();
      fake.created.set(id, { createdTimestamp: Date.now(), ...body });
      await fake.afterCreate?.();
      return new HttpResponse(null, { status: 201, headers: { location: `${users}/${id}` } });
    }),
    http.get(users, () =>
      HttpResponse.json(
        [...fake.created].map(([id, user]) => ({ id, createdTimestamp: user.createdTimestamp })),
      ),
    ),
    http.get(`${users}/:id`, ({ params }) => {
      const user = fake.created.get(String(params.id));
      return user === undefined
        ? HttpResponse.json({ error: 'User not found' }, { status: 404 })
        : HttpResponse.json({ id: params.id, ...user });
    }),
    http.put(`${users}/:id`, async ({ params, request }) => {
      const id = String(params.id);
      const user = fake.created.get(id);
      const body = (await request.json()) as Record<string, unknown>;
      if (user === undefined) {
        return HttpResponse.json({ error: 'User not found' }, { status: 404 });
      }
      if (isEmailTaken(body.email, id)) {
        return HttpResponse.json({ errorMessage: 'User exists with same email' }, { status: 409 });
      }
      fake.created.set(id, { ...user, ...body });
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`${users}/:id/federated-identity`, ({ params }) =>
      HttpResponse.json(
        Object.entries(fake.federatedIdentities.get(String(params.id)) ?? {}).map(
          ([identityProvider, userName]) => ({ identityProvider, userId: userName, userName }),
        ),
      ),
    ),
    http.get(`${config.keycloak.adminUrl}/groups`, () =>
      HttpResponse.json([{ id: TEAM_GROUP_ID, name: 'team', path: '/team' }]),
    ),
    http.put(`${users}/:id/groups/:groupId`, ({ params }) => {
      if (params.groupId === TEAM_GROUP_ID) {
        fake.teamMembers.add(String(params.id));
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete(`${users}/:id`, ({ params }) => {
      const id = String(params.id);
      fake.deleted.push(id);
      fake.created.delete(id);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
  return fake;
}
