import { type DynamicModule, Module } from '@nestjs/common';
import { ABILITY_DEFINITIONS } from './ability-definitions.js';
import { AuditLogEntriesWorkerModule } from './modules/audit-log-entries/audit-log-entries-worker.module.js';
import { InvitationsWorkerModule } from './modules/invitations/invitations-worker.module.js';
import {
  SCHEDULE_RESOLUTION_CONFIRMATION_CLOSE_SUBSCRIPTION,
  UNASSIGN_DEACTIVATED_USER_SUBSCRIPTION,
  UNASSIGN_REMOVED_MEMBER_SUBSCRIPTION,
} from './modules/tickets/tickets.jobs.js';
import { TicketsWorkerModule } from './modules/tickets/tickets-worker.module.js';
import { USERS_KEYCLOAK_SUBSCRIPTION } from './modules/users/users.jobs.js';
import { UsersWorkerModule } from './modules/users/users-worker.module.js';
import type { TrybunConfig } from './platform/config/config.schema.js';
import { AuthorizationModule } from './platform/authorization/authorization.module.js';
import { ClamavModule } from './platform/clamav/clamav.module.js';
import { ClockModule } from './platform/clock/clock.module.js';
import { ConfigModule } from './platform/config/config.module.js';
import { DatabaseModule } from './platform/database/database.module.js';
import { I18nModule } from './platform/i18n/i18n.module.js';
import { KeycloakAdminModule } from './platform/keycloak-admin/keycloak-admin.module.js';
import { HeartbeatModule } from './platform/health/heartbeat.module.js';
import { LoggingModule } from './platform/logging/logging.module.js';
import { OutboxWorkerModule } from './platform/outbox/outbox-worker.module.js';
import { QueuesModule } from './platform/queues/queues.module.js';
import { StorageWorkerModule } from './platform/storage/storage-worker.module.js';

/**
 * Root module of the Worker process (§14.6); feature worker modules are imported here, and their
 * outbox subscriptions are passed to the outbox publisher.
 */
@Module({})
export class WorkerModule {
  static forRoot(config: TrybunConfig): DynamicModule {
    return {
      module: WorkerModule,
      imports: [
        ConfigModule.forRoot(config),
        LoggingModule.forRoot(),
        ClockModule,
        DatabaseModule,
        I18nModule,
        QueuesModule,
        // The services of the feature modules the jobs use depend on the ability factory.
        AuthorizationModule.forRoot(ABILITY_DEFINITIONS),
        KeycloakAdminModule,
        StorageWorkerModule,
        ClamavModule,
        OutboxWorkerModule.forRoot([
          USERS_KEYCLOAK_SUBSCRIPTION,
          UNASSIGN_DEACTIVATED_USER_SUBSCRIPTION,
          UNASSIGN_REMOVED_MEMBER_SUBSCRIPTION,
          SCHEDULE_RESOLUTION_CONFIRMATION_CLOSE_SUBSCRIPTION,
        ]),
        AuditLogEntriesWorkerModule,
        InvitationsWorkerModule,
        UsersWorkerModule,
        TicketsWorkerModule,
        HeartbeatModule,
      ],
    };
  }
}
