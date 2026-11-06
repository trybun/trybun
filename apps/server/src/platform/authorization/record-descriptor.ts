import type { ForcedSubject } from '@casl/ability';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Principal } from '../authentication/principal.js';
import type { Transaction } from '../database/prisma.service.js';
import type {
  AttachmentRuleRecord,
  InvitationRuleRecord,
  OrganizationRuleRecord,
  ProjectRuleRecord,
  TicketRuleRecord,
  UserRuleRecord,
} from './ability-factory.js';

/** The subjects with records and the records their rules read (§18.3). */
export interface RuleRecords {
  Project: ProjectRuleRecord;
  Organization: OrganizationRuleRecord;
  Invitation: InvitationRuleRecord;
  User: UserRuleRecord;
  Ticket: TicketRuleRecord;
  Attachment: AttachmentRuleRecord;
}

/** The Prisma filter of each subject with records. */
export interface RecordFilters {
  Project: Prisma.ProjectWhereInput;
  Organization: Prisma.OrganizationWhereInput;
  Invitation: Prisma.InvitationWhereInput;
  User: Prisma.UserWhereInput;
  Ticket: Prisma.TicketWhereInput;
  Attachment: Prisma.AttachmentWhereInput;
}

export type RecordSubject = keyof RuleRecords;

/** A record as a subject of the ability: one per subject, so a union stays a union of subjects. */
export type SubjectRecord<S extends RecordSubject = RecordSubject> = S extends RecordSubject
  ? RuleRecords[S] & ForcedSubject<S>
  : never;

/**
 * How the record access loads a record of a subject (§18.3): defined in `<feature>.abilities.ts`
 * next to the rules and passed to `AuthorizationModule.forRoot()` by the root module. It selects
 * the fields the rules read, with relations limited to the principal; it takes a transaction
 * client, so services can load the same record inside their transactions, and returns the record
 * as a subject (`subject()` of CASL).
 */
export interface RecordDescriptor<S extends RecordSubject = RecordSubject> {
  readonly subject: S;
  find(
    db: Transaction,
    where: RecordFilters[S],
    principal: Principal,
  ): Promise<SubjectRecord<S> | null>;
}

export const RECORD_DESCRIPTORS = Symbol('RecordDescriptors');
