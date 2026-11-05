// The deletion of Keycloak users without an account (AQ2), with the Admin API in MSW and a fixed
// clock (§18.7).
import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser } from '../../../test/factories/user.factory.js';
import { keycloakAdminFake, type KeycloakAdminFake } from '../../../test/msw/keycloak-admin.js';
import { mswServer } from '../../../test/msw/server.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { Clock } from '../../platform/clock/clock.js';
import { ConfigModule } from '../../platform/config/config.module.js';
import { DatabaseModule } from '../../platform/database/database.module.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { KeycloakAdminModule } from '../../platform/keycloak-admin/keycloak-admin.module.js';
import { LoggingModule } from '../../platform/logging/logging.module.js';
import { KeycloakUserCleanupService } from './keycloak-user-cleanup.service.js';

const HOUR_MS = 60 * 60 * 1_000;
const NOW = new Date('2026-10-29T12:00:00Z');

class FixedClock extends Clock {
  now(): Date {
    return NOW;
  }
}

describe('cleanup of Keycloak users without an account', () => {
  const config = integrationConfig();
  let context: INestApplicationContext;
  let prisma: PrismaService;
  let cleanup: KeycloakUserCleanupService;
  let keycloak: KeycloakAdminFake;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(config),
        LoggingModule.forRoot(),
        DatabaseModule,
        KeycloakAdminModule,
      ],
      providers: [KeycloakUserCleanupService, { provide: Clock, useClass: FixedClock }],
    }).compile();
    context = await moduleRef.init();
    prisma = context.get(PrismaService);
    cleanup = context.get(KeycloakUserCleanupService);
  });

  beforeEach(() => {
    keycloak = keycloakAdminFake(config);
    mswServer.use(...keycloak.handlers);
  });

  afterAll(async () => {
    await context.close();
  });

  /** A Keycloak user created the given number of hours before now. */
  function keycloakUser(hoursAgo: number): string {
    return keycloak.addUser({
      email: `${randomUUID()}@example.com`,
      createdTimestamp: NOW.getTime() - hoursAgo * HOUR_MS,
    });
  }

  it('deletes users without an account 24 hours after their creation, once', async () => {
    const orphan = keycloakUser(25);
    const recent = keycloakUser(23);
    const linked = keycloakUser(48);
    const invited = keycloakUser(48);
    await createUser(prisma, { keycloakUserId: linked });
    // An account in any state keeps its Keycloak user, e.g. a deactivated one.
    await createUser(prisma, { keycloakUserId: invited, state: 'deactivated' });

    expect(await cleanup.deleteUsersWithoutAccount()).toBe(1);
    expect(await cleanup.deleteUsersWithoutAccount()).toBe(0);

    expect(keycloak.deleted).toEqual([orphan]);
    expect([...keycloak.created.keys()].sort()).toEqual([recent, linked, invited].sort());
  });
});
