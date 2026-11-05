import { Inject, Injectable } from '@nestjs/common';
import type { ErrorCode } from '@trybun/contracts/errors';
import { z } from 'zod';
import { TRYBUN_CONFIG } from '../config/config.module.js';
import type { TrybunConfig } from '../config/config.schema.js';
import { AppError } from '../errors/app-error.js';
import type {
  KeycloakAdmin,
  KeycloakUserProfile,
  KeycloakUserSummary,
  NewAdministrator,
  NewEndUser,
} from './keycloak-admin.js';

/** The client of the service account (docker/keycloak/realm/trybun.yaml). */
const SERVER_CLIENT_ID = 'trybun-server';

/** The group whose members must use 2FA (§7.4). */
const TEAM_GROUP = '/team';

/** The alias of the GitHub identity provider (docker/keycloak/realm/github.yaml). */
const GITHUB = 'github';

const USERS_PAGE_SIZE = 100;

const userProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

/** `userName` of a GitHub identity is the GitHub login (ADR 0009). */
const federatedIdentitiesSchema = z.array(
  z.object({ identityProvider: z.string(), userName: z.string() }),
);

const groupsSchema = z.array(z.object({ id: z.string(), path: z.string() }));

const userSummariesSchema = z.array(
  z.object({
    id: z.string(),
    createdTimestamp: z.number(),
    serviceAccountClientId: z.string().optional(),
  }),
);

const tokenResponseSchema = z.object({ access_token: z.string() });

/** An error response of the Admin API, e.g. `{ "errorMessage": "User exists with same email" }`. */
const errorResponseSchema = z
  .object({ errorMessage: z.string(), error: z.string(), error_description: z.string() })
  .partial()
  .catch({});

/**
 * The Keycloak Admin API over the internal network (§14.4). Each call obtains a token of the
 * service account with the client credentials grant: the calls are rare (the first-run wizard, the
 * acceptance of invitations, the deactivation and reactivation of accounts, an hourly cleanup), so
 * the token is not cached.
 */
@Injectable()
export class KeycloakAdminClient implements KeycloakAdmin {
  constructor(@Inject(TRYBUN_CONFIG) private readonly config: TrybunConfig) {}

  async createAdministrator(administrator: NewAdministrator): Promise<string> {
    return this.createUser(
      administrator,
      { groups: [TEAM_GROUP], requiredActions: ['CONFIGURE_TOTP'] },
      { emailTaken: 'setup.email_taken', passwordRejected: 'setup.password_rejected' },
    );
  }

  async createEndUser(endUser: NewEndUser): Promise<string> {
    return this.createUser(
      endUser,
      {},
      { emailTaken: 'invitation.email_taken', passwordRejected: 'invitation.password_rejected' },
    );
  }

  async findUserProfile(keycloakUserId: string): Promise<KeycloakUserProfile | null> {
    const response = await this.request('GET', userPath(keycloakUserId));
    if (response.status === 404) {
      await response.body?.cancel();
      return null;
    }
    await assertOk(response, 'read user');
    const user = userProfileSchema.parse(await response.json());
    return { firstName: user.firstName ?? null, lastName: user.lastName ?? null };
  }

  async setVerifiedEmail(keycloakUserId: string, email: string): Promise<void> {
    const response = await this.request('PUT', userPath(keycloakUserId), {
      email,
      emailVerified: true,
    });
    if (response.status === 409) {
      await response.body?.cancel();
      throw new AppError('invitation.email_taken');
    }
    await assertOk(response, 'update user');
  }

  async findGithubLogin(keycloakUserId: string): Promise<string | null> {
    const response = await this.request('GET', `${userPath(keycloakUserId)}/federated-identity`);
    await assertOk(response, 'read federated identities');
    const identities = federatedIdentitiesSchema.parse(await response.json());
    return identities.find(({ identityProvider }) => identityProvider === GITHUB)?.userName ?? null;
  }

  async addToTeamGroup(keycloakUserId: string): Promise<void> {
    const groups = await this.request(
      'GET',
      `/groups?exact=true&briefRepresentation=true&search=${encodeURIComponent(TEAM_GROUP.slice(1))}`,
    );
    await assertOk(groups, 'find group');
    const group = groupsSchema.parse(await groups.json()).find(({ path }) => path === TEAM_GROUP);
    if (group === undefined) {
      throw new Error('Keycloak Admin API: the group team does not exist');
    }
    const response = await this.request(
      'PUT',
      `${userPath(keycloakUserId)}/groups/${encodeURIComponent(group.id)}`,
    );
    await assertOk(response, 'join group');
  }

  async listUsers(): Promise<KeycloakUserSummary[]> {
    const users: KeycloakUserSummary[] = [];
    for (let first = 0; ; first += USERS_PAGE_SIZE) {
      const response = await this.request(
        'GET',
        `/users?briefRepresentation=true&first=${first}&max=${USERS_PAGE_SIZE}`,
      );
      await assertOk(response, 'list users');
      const page = userSummariesSchema.parse(await response.json());
      for (const user of page) {
        if (user.serviceAccountClientId === undefined) {
          users.push({ id: user.id, createdAt: new Date(user.createdTimestamp) });
        }
      }
      if (page.length < USERS_PAGE_SIZE) {
        return users;
      }
    }
  }

  async deleteUser(keycloakUserId: string): Promise<void> {
    const response = await this.request('DELETE', userPath(keycloakUserId));
    if (response.status !== 404) {
      await assertOk(response, 'delete user');
    }
  }

  /**
   * Creates a user with the password as its only credential; the address is its user name, so
   * the sign-in form pre-filled with it finds the user.
   */
  private async createUser(
    user: NewAdministrator,
    extra: { groups?: string[]; requiredActions?: string[] },
    codes: { emailTaken: ErrorCode; passwordRejected: ErrorCode },
  ): Promise<string> {
    const response = await this.request('POST', '/users', {
      username: user.email,
      email: user.email,
      emailVerified: true,
      enabled: true,
      firstName: user.firstName,
      lastName: user.lastName,
      attributes: { locale: [user.language] },
      ...extra,
      credentials: [{ type: 'password', value: user.password, temporary: false }],
    });
    if (response.status === 409) {
      await response.body?.cancel();
      throw new AppError(codes.emailTaken, [{ pointer: '/email', code: 'field.invalid' }]);
    }
    if (response.status === 400) {
      const body = errorResponseSchema.parse(await response.json().catch(() => ({})));
      const message = [body.errorMessage, body.error, body.error_description].join(' ');
      if (/password/i.test(message)) {
        throw new AppError(codes.passwordRejected, [
          { pointer: '/password', code: 'field.invalid' },
        ]);
      }
    }
    await assertOk(response, 'create user');
    // `Location: …/admin/realms/trybun/users/<id>`
    const id = response.headers.get('location')?.split('/').pop();
    if (id === undefined || id === '') {
      throw new Error('Keycloak Admin API: create user returned no location');
    }
    return id;
  }

  async setUserEnabled(keycloakUserId: string, enabled: boolean): Promise<void> {
    const response = await this.request('PUT', userPath(keycloakUserId), {
      enabled,
    });
    if (response.status !== 404) {
      await assertOk(response, 'update user');
    }
  }

  async logoutUser(keycloakUserId: string): Promise<void> {
    const response = await this.request(
      'POST',
      `/users/${encodeURIComponent(keycloakUserId)}/logout`,
    );
    if (response.status !== 404) {
      await assertOk(response, 'log out user');
    }
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    return fetch(`${this.config.keycloak.adminUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await this.serviceAccountToken()}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private async serviceAccountToken(): Promise<string> {
    const response = await fetch(this.config.keycloak.tokenUrl, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: SERVER_CLIENT_ID,
        client_secret: this.config.keycloak.serverClientSecret,
      }),
    });
    await assertOk(response, 'service account token');
    return tokenResponseSchema.parse(await response.json()).access_token;
  }
}

/** An unexpected response: a server error (`500`) without the response body, which may name the user. */
async function assertOk(response: Response, operation: string): Promise<void> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Keycloak Admin API: ${operation} failed with status ${response.status}`);
  }
}

function userPath(keycloakUserId: string): string {
  return `/users/${encodeURIComponent(keycloakUserId)}`;
}
