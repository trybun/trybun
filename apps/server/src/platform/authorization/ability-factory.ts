import { type Ability, AbilityBuilder } from '@casl/ability';
import { createPrismaAbility, type PrismaQueryOf, type Subjects } from '@casl/prisma/runtime';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Principal } from '../authentication/principal.js';
import { Clock } from '../clock/clock.js';

/**
 * The subjects of the abilities (§18.3): the Prisma model names – with their records, whose rule
 * conditions are Prisma `WhereInput`s – and the parts of the system without records (e.g.
 * `Administration`). A record carries only the fields its rules read. Feature tasks add their
 * models.
 */
export type AppSubject =
  | Subjects<{
      Project: ProjectRuleRecord;
      Organization: OrganizationRuleRecord;
      Invitation: InvitationRuleRecord;
      User: UserRuleRecord;
      Ticket: TicketRuleRecord;
      Attachment: AttachmentRuleRecord;
      Comment: CommentRuleRecord;
    }>
  | 'Administration';

/**
 * A project as its rules read it: its state, the membership of the principal, loaded with
 * `members: { where: { userId: principal.userId } }`, and the access of the principal's
 * organization with its state, loaded the same way (§7.3).
 */
export type ProjectRuleRecord = {
  id: string;
  state: string;
  members: { userId: string; role: string }[];
  organizations: { organization: { state: string; members: { userId: string }[] } }[];
};

/** An organization as its rules read it: its state (§7.3). */
export type OrganizationRuleRecord = {
  id: string;
  state: string;
};

/**
 * An invitation as its rules read it (§7.4): its target, the state of its project and
 * organization and the memberships of the principal in the project. A new invitation is checked as
 * such a record before it exists.
 */
export type InvitationRuleRecord = {
  target: string;
  project: { state: string; members: { userId: string; role: string }[] } | null;
  organization: { state: string } | null;
};

/** An account as its rules read it: its kind, state and the Administrator flag (§7.4). */
export type UserRuleRecord = {
  id: string;
  kind: string;
  state: string;
  isAdmin: boolean;
};

/**
 * A ticket as its rules read it (§7.5): its requester and its project as the project's rules read
 * it.
 */
export type TicketRuleRecord = {
  id: string;
  requesterId: string;
  project: ProjectRuleRecord;
};

/**
 * An attachment as its rules read it (§7.5): its uploader and, once linked, its ticket or its
 * comment as their rules read them; both `null` for a draft.
 */
export type AttachmentRuleRecord = {
  id: string;
  uploadedById: string;
  ticketId: string | null;
  commentId: string | null;
  ticket: TicketRuleRecord | null;
  comment: CommentRuleRecord | null;
};

/**
 * A comment as its rules read it (§7.5): its author, kind and audience, the principal's own
 * membership of its audience organization, and its ticket as the ticket's rules read it.
 */
export type CommentRuleRecord = {
  id: string;
  authorId: string;
  kind: string;
  audience: string | null;
  audienceOrganization: { members: { userId: string }[] } | null;
  ticket: TicketRuleRecord;
};

/** The conditions of a rule: the Prisma `WhereInput` of its subject. */
export type PrismaQuery = PrismaQueryOf<Prisma.TypeMap>;

/**
 * The CASL ability of a principal (§18.3): actions are the snake_case codes of `@trybun/contracts`.
 * The same rules check actions on records and build the filters of queries (`accessibleBy`).
 */
export type AppAbility = Ability<[string, AppSubject], PrismaQuery>;

/**
 * The rules a feature module defines in its `<feature>.abilities.ts` (§18.3), given the current
 * time for the rules that depend on it, e.g. comments on a ticket closed for 14 days (§4.3,
 * ADR 0013). Rules that do not depend on it ignore the parameter.
 */
export type AbilityRules = (
  builder: AbilityBuilder<AppAbility>,
  principal: Principal,
  now: Date,
) => void;

export const ABILITY_RULES = Symbol('AbilityRules');
export const ABILITY_RESTRICTIONS = Symbol('AbilityRestrictions');

/** The rules of the feature modules and the global restrictions added after them (§18.3). */
export interface AbilityDefinitions {
  rules: readonly AbilityRules[];
  /** `cannot` rules that override every other rule, e.g. the archived state of projects. */
  restrictions: readonly AbilityRules[];
}

/**
 * Builds the ability of a principal from the rules of all feature modules, passed to
 * `AuthorizationModule.forRoot()` by the root module, followed by the global restrictions (§18.3),
 * so they override every other rule. The current time comes from the injected clock, read once per
 * ability, so every rule of one ability sees the same time (ADR 0013).
 */
@Injectable()
export class AbilityFactory {
  constructor(
    @Inject(ABILITY_RULES) private readonly rules: readonly AbilityRules[],
    @Inject(ABILITY_RESTRICTIONS) private readonly restrictions: readonly AbilityRules[],
    private readonly clock: Clock,
  ) {}

  forPrincipal(principal: Principal): AppAbility {
    const builder = new AbilityBuilder<AppAbility>(createPrismaAbility);
    const now = this.clock.now();
    for (const define of [...this.rules, ...this.restrictions]) {
      define(builder, principal, now);
    }
    return builder.build();
  }
}
