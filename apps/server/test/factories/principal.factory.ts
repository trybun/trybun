import { subject } from '@casl/ability';
import type {
  TicketSharingRequest,
  TicketSource,
  TicketStatus,
  TicketVisibility,
  TicketWaitingReason,
} from '@trybun/contracts/tickets';
import type { UserPrincipal } from '../../src/platform/authentication/principal.js';

export const PRINCIPAL_ID = '0190f2f4-7c1e-7000-8000-000000000001';

/**
 * The principals of the permission tests (§18.7), each named after its relation to the project of
 * the records below: a member with a team role, a team account without membership, and end users
 * with personal access, with access through an active or an archived organization, or without
 * access.
 */
export const PRINCIPAL_FIXTURES = [
  'admin',
  'project_manager',
  'developer',
  'team_member',
  'end_user_personal',
  'end_user_organization',
  'end_user_archived_organization',
  'end_user',
] as const;

export type PrincipalFixture = (typeof PRINCIPAL_FIXTURES)[number];

export function buildPrincipal(fixture: PrincipalFixture): UserPrincipal {
  return {
    kind: 'user',
    userId: PRINCIPAL_ID,
    userKind: fixture.startsWith('end_user') ? 'end_user' : 'team',
    isAdmin: fixture === 'admin',
  };
}

/** The principal's own membership of the project, as the record descriptors load it. */
export function buildMembers(fixture: PrincipalFixture): { userId: string; role: string }[] {
  switch (fixture) {
    case 'project_manager':
    case 'developer':
      return [{ userId: PRINCIPAL_ID, role: fixture }];
    case 'end_user_personal':
      return [{ userId: PRINCIPAL_ID, role: 'end_user' }];
    default:
      return [];
  }
}

/** The access of the principal's organization to the project, as the project descriptor loads it. */
function buildOrganizationAccess(fixture: PrincipalFixture) {
  switch (fixture) {
    case 'end_user_organization':
      return [{ organization: { state: 'active', members: [{ userId: PRINCIPAL_ID }] } }];
    case 'end_user_archived_organization':
      return [{ organization: { state: 'archived', members: [{ userId: PRINCIPAL_ID }] } }];
    default:
      return [];
  }
}

/** A project as its record descriptor loads it for the principal of a fixture. */
export function buildProjectRecord(
  fixture: PrincipalFixture,
  state: 'active' | 'archived' = 'active',
) {
  return subject('Project', {
    id: 'project',
    state,
    members: buildMembers(fixture),
    organizations: buildOrganizationAccess(fixture),
  });
}

/**
 * An invitation as its record descriptor loads it for the principal of a fixture: its target, the
 * state of its project and organization – the organization of a project invitation is the one
 * matched by domain, if any – and the principal's membership of the project.
 */
export function buildInvitationRecord(
  fixture: PrincipalFixture,
  target: 'project' | 'organization' | 'administrator',
  states: { project?: 'active' | 'archived'; organization?: 'active' | 'archived' } = {},
) {
  const organizationState = states.organization ?? (target === 'organization' ? 'active' : null);
  return subject('Invitation', {
    target,
    project:
      target === 'project'
        ? { state: states.project ?? 'active', members: buildMembers(fixture) }
        : null,
    organization: organizationState === null ? null : { state: organizationState },
  });
}

/** The options of a ticket record of a fixture. */
export interface TicketRecordOptions {
  own?: boolean;
  state?: 'active' | 'archived';
  status?: TicketStatus;
  waitingReason?: TicketWaitingReason | null;
  /** The latest close; set by default for a terminal status, as the check constraints require. */
  closedAt?: Date | null;
  source?: TicketSource;
  visibility?: TicketVisibility;
  sharingRequest?: TicketSharingRequest;
  /**
   * The organization snapshot: `mine` – an organization the principal belongs to, `other` – one
   * they do not belong to (e.g. one they left), `null` – none (the default).
   */
  organization?: 'mine' | 'other' | null;
  organizationState?: 'active' | 'archived';
}

const SOMEONE_ELSE = '0190f2f4-7c1e-7000-8000-000000000099';

function ticketFields(fixture: PrincipalFixture, options: TicketRecordOptions) {
  return {
    id: 'ticket',
    requesterId: options.own === true ? PRINCIPAL_ID : SOMEONE_ELSE,
    status: options.status ?? 'in_progress',
    waitingReason: options.waitingReason ?? null,
    closedAt:
      options.closedAt !== undefined
        ? options.closedAt
        : ['done', 'rejected', 'duplicate'].includes(options.status ?? '')
          ? new Date('2026-11-08T10:00:00.000Z')
          : null,
    source: options.source ?? 'user',
    visibility: options.visibility ?? 'only_me',
    sharingRequest: options.sharingRequest ?? 'none',
    organizationId: options.organization == null ? null : 'organization',
    organization:
      options.organization == null
        ? null
        : {
            state: options.organizationState ?? 'active',
            members: options.organization === 'mine' ? [{ userId: PRINCIPAL_ID }] : [],
          },
    project: {
      id: 'project',
      state: options.state ?? 'active',
      members: buildMembers(fixture),
      organizations: buildOrganizationAccess(fixture),
    },
  };
}

/**
 * A ticket as its record descriptor loads it for the principal of a fixture: of its project, as the
 * project descriptor loads it; requested by the principal (`own`) or by someone else.
 */
export function buildTicketRecord(fixture: PrincipalFixture, options: TicketRecordOptions = {}) {
  return subject('Ticket', ticketFields(fixture, options));
}

/**
 * An attachment as its record descriptor loads it for the principal of a fixture: uploaded by the
 * principal (`own`) or by someone else, a draft or linked to a ticket as `buildTicketRecord` loads
 * it (`ticket`, requested by the principal with `ticket.own`).
 */
export function buildAttachmentRecord(
  fixture: PrincipalFixture,
  options: {
    own?: boolean;
    ticket?: TicketRecordOptions | null;
    comment?: CommentRecordOptions;
  } = {},
) {
  const comment = options.comment === undefined ? null : commentFields(fixture, options.comment);
  const ticket =
    options.ticket === null || comment !== null
      ? null
      : ticketFields(fixture, options.ticket ?? {});
  return subject('Attachment', {
    id: 'attachment',
    uploadedById: options.own === true ? PRINCIPAL_ID : SOMEONE_ELSE,
    ticketId: ticket?.id ?? null,
    commentId: comment?.id ?? null,
    ticket,
    comment,
  });
}

/** The options of a comment record of a fixture. */
export interface CommentRecordOptions {
  /** Written by the principal. */
  own?: boolean;
  kind?: 'public' | 'internal';
  /** The audience of a public comment; `only_me` by default, none for an internal note. */
  audience?: TicketVisibility;
  /** For `my_organization`: whether the principal belongs to the audience organization. */
  audienceOrganization?: 'mine' | 'other';
  ticket?: TicketRecordOptions;
}

function commentFields(fixture: PrincipalFixture, options: CommentRecordOptions) {
  const kind = options.kind ?? 'public';
  const audience = kind === 'internal' ? null : (options.audience ?? 'only_me');
  return {
    id: 'comment',
    authorId: options.own === true ? PRINCIPAL_ID : SOMEONE_ELSE,
    kind,
    audience,
    audienceOrganization:
      audience !== 'my_organization'
        ? null
        : {
            members:
              (options.audienceOrganization ?? 'mine') === 'mine' ? [{ userId: PRINCIPAL_ID }] : [],
          },
    ticket: ticketFields(fixture, options.ticket ?? {}),
  };
}

/** A comment as its record descriptor loads it for the principal of a fixture. */
export function buildCommentRecord(fixture: PrincipalFixture, options: CommentRecordOptions = {}) {
  return subject('Comment', commentFields(fixture, options));
}
