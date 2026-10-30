import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { USERS_KEYCLOAK_QUEUE } from './users.jobs.js';
import { UsersKeycloakProcessor } from './users.processor.js';
import { UsersKeycloakService } from './users-keycloak.service.js';

/**
 * The jobs of the accounts (§7.4), imported only by the Worker: the Keycloak user follows the
 * state of its account.
 */
@Module({
  imports: [BullModule.registerQueue({ name: USERS_KEYCLOAK_QUEUE })],
  providers: [UsersKeycloakService, UsersKeycloakProcessor],
})
export class UsersWorkerModule {}
