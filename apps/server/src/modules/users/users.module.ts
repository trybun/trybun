import { Module } from '@nestjs/common';
import { SessionsModule } from '../../platform/authentication/sessions.module.js';
import { OutboxModule } from '../../platform/outbox/outbox.module.js';
import { AuditLogEntriesModule } from '../audit-log-entries/audit-log-entries.module.js';
import { InvitationRevocationsModule } from '../invitations/invitation-revocations.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

/** Accounts (§7.4): the own account and its settings, the Accounts page of the Administrator. */
@Module({
  imports: [AuditLogEntriesModule, InvitationRevocationsModule, OutboxModule, SessionsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
