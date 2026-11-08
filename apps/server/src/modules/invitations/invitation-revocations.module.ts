import { Module } from '@nestjs/common';
import { AuditLogEntriesModule } from '../audit-log-entries/audit-log-entries.module.js';
import { InvitationRevocationsService } from './invitation-revocations.service.js';

/**
 * The revocation of pending invitations as an effect of other changes (§7.3, §7.4), imported by the
 * modules whose use cases have that effect.
 */
@Module({
  imports: [AuditLogEntriesModule],
  providers: [InvitationRevocationsService],
  exports: [InvitationRevocationsService],
})
export class InvitationRevocationsModule {}
