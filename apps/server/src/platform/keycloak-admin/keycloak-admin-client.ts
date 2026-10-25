import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TRYBUN_CONFIG } from '../config/config.module.js';
import type { TrybunConfig } from '../config/config.schema.js';
import { AppError } from '../errors/app-error.js';
import type { KeycloakAdmin, NewAdministrator } from './keycloak-admin.js';

/** The client of the service account (docker/keycloak/realm/trybun.yaml). */
const SERVER_CLIENT_ID = 'trybun-server';

/** The group whose members must use 2FA (§7.4). */
const TEAM_GROUP = '/team';

const tokenResponseSchema = z.object({ access_token: z.string() });

/** An error response of the Admin API, e.g. `{ "errorMessage": "User exists with same email" }`. */
const errorResponseSchema = z
  .object({ errorMessage: z.string(), error: z.string(), error_description: z.string() })
  .partial()
  .catch({});

/**
 * The Keycloak Admin API over the internal network (§14.4). Each call obtains a token of the
 * service account with the client credentials grant: the calls are rare (the first-run wizard), so
 * the token is not cached.
 */
@Injectable()
export class KeycloakAdminClient implements KeycloakAdmin {
  constructor(@Inject(TRYBUN_CONFIG) private readonly config: TrybunConfig) {}

  async createAdministrator(administrator: NewAdministrator): Promise<string> {
    const response = await this.request('POST', '/users', {
      username: administrator.email,
      email: administrator.email,
      emailVerified: true,
      enabled: true,
      firstName: administrator.firstName,
      lastName: administrator.lastName,
      attributes: { locale: [administrator.language] },
      groups: [TEAM_GROUP],
      requiredActions: ['CONFIGURE_TOTP'],
      credentials: [{ type: 'password', value: administrator.password, temporary: false }],
    });
    if (response.status === 409) {
      throw new AppError('setup.email_taken', [{ pointer: '/email', code: 'field.invalid' }]);
    }
    if (response.status === 400) {
      const body = errorResponseSchema.parse(await response.json().catch(() => ({})));
      const message = [body.errorMessage, body.error, body.error_description].join(' ');
      if (/password/i.test(message)) {
        throw new AppError('setup.password_rejected', [
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

  async deleteUser(keycloakUserId: string): Promise<void> {
    const response = await this.request('DELETE', `/users/${encodeURIComponent(keycloakUserId)}`);
    if (response.status !== 404) {
      await assertOk(response, 'delete user');
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
