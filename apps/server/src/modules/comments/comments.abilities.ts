import { subject } from '@casl/ability';
import { type CommentAction, commentActionSchema } from '@trybun/contracts/comments';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Principal } from '../../platform/authentication/principal.js';
import type { AbilityRules } from '../../platform/authorization/ability-factory.js';
import type { RecordDescriptor } from '../../platform/authorization/record-descriptor.js';
import {
  memberFrom,
  ticketReadConditions,
  ticketRuleSelect,
} from '../tickets/tickets.abilities.js';

/** The subject of the comments (§18.3). */
export const COMMENT = 'Comment';

/** The contract's closed list (§18.3): an action added to it is restricted by default. */
const ALL_ACTIONS = commentActionSchema.options;

/** The actions an archived project still allows on its comments: reading them and their history. */
const ACTIONS_OF_ARCHIVED_PROJECTS: readonly CommentAction[] = ['read', 'read_revisions'];

/**
 * The audience conditions of a public comment for an end user (§5.2), given one condition under
 * which they read its ticket: they wrote it, or its audience includes them – every customer for
 * `all_customers`, the members of its organization for `my_organization` (a relation condition,
 * as the principal holds no organization, S1-04 Q2), the requester for `only_me`.
 */
function audienceConditions(
  principal: Principal,
  ticket: Prisma.TicketWhereInput,
): Prisma.CommentWhereInput[] {
  const readable = { kind: 'public' as const, ticket: { is: ticket } };
  return [
    { ...readable, authorId: principal.userId },
    { ...readable, audience: 'all_customers' },
    {
      ...readable,
      audience: 'my_organization',
      audienceOrganization: { is: { members: { some: { userId: principal.userId } } } },
    },
    {
      kind: 'public',
      audience: 'only_me',
      ticket: { is: { AND: [ticket, { requesterId: principal.userId }] } },
    },
  ];
}

/**
 * The conditions under which a principal reads a comment (§7.5), one CASL rule per condition: the
 * team every comment and note of the tickets it reads; an end user a public comment of a ticket
 * they read whose audience includes them (`audienceConditions`). Lists and details use the same
 * rules, so a list never shows a comment its detail refuses (§18.3). The attachment rules wrap
 * them, so comment attachments follow the comment's kind and audience (§13.3).
 */
export function commentReadConditions(principal: Principal): Prisma.CommentWhereInput[] {
  const tickets = ticketReadConditions(principal);
  if (principal.userKind !== 'end_user') {
    return tickets.map((ticket) => ({ ticket: { is: ticket } }));
  }
  return tickets.flatMap((ticket) => audienceConditions(principal, ticket));
}

/**
 * The conditions under which a principal deletes a comment (§7.5): the author their own, the
 * team – a Developer and above of the project, and the Administrator – any. Also on closed tickets
 * (S1-12 Q12).
 */
export function commentDeleteConditions(principal: Principal): Prisma.CommentWhereInput[] {
  if (principal.userKind !== 'end_user') {
    return commentReadConditions(principal);
  }
  return ownCommentConditions(principal);
}

/** The own comments of a principal that they still read (§7.5, S1-12 Q12). */
function ownCommentConditions(principal: Principal): Prisma.CommentWhereInput[] {
  return ticketReadConditions(principal).map((ticket) => ({
    authorId: principal.userId,
    ticket: { is: ticket },
    ...(principal.userKind === 'end_user' ? { kind: 'public' as const } : {}),
  }));
}

/**
 * The rules of comments (§7.5): everyone reads the comments their ticket and the comment's
 * audience allow (`commentReadConditions`) and edits and deletes their own, also on closed
 * tickets (S1-12 Q12); a Developer and above deletes and redacts any comment of their projects and
 * reads every revision, an end user the revisions of their own comments (S1-12 Q3).
 */
export const commentsAbilities: AbilityRules = ({ can }, principal) => {
  for (const conditions of commentReadConditions(principal)) {
    can('read', COMMENT, conditions);
  }
  for (const conditions of ownCommentConditions(principal)) {
    can(['update', 'delete'], COMMENT, conditions);
  }
  if (principal.userKind === 'end_user') {
    for (const conditions of ownCommentConditions(principal)) {
      can('read_revisions', COMMENT, conditions);
    }
    return;
  }
  if (principal.isAdmin) {
    can(['delete', 'redact', 'read_revisions'], COMMENT);
    return;
  }
  can(['delete', 'redact', 'read_revisions'], COMMENT, {
    ticket: { is: { project: { is: memberFrom(principal, 'developer') } } },
  });
};

/**
 * A global restriction (§18.3), added after every rule: the comments of an archived project are
 * read-only for everyone, the Administrator included (§7.3, S1-04 Q10); reading them and their
 * history stays allowed. Its reason makes the API answer `409 project.archived` instead of `403`.
 */
export const archivedProjectsOfCommentsRestriction: AbilityRules = ({ cannot }) => {
  cannot(
    ALL_ACTIONS.filter((action) => !ACTIONS_OF_ARCHIVED_PROJECTS.includes(action)),
    COMMENT,
    { ticket: { is: { project: { is: { state: 'archived' } } } } },
  ).because('project.archived');
};

/**
 * The fields of a comment its rules read (§18.3): its author, kind and audience, of its audience
 * organization the principal's own membership, and of its ticket the fields the ticket's rules
 * read.
 */
export function commentRuleSelect(principal: Principal) {
  return {
    id: true,
    authorId: true,
    kind: true,
    audience: true,
    audienceOrganization: {
      select: { members: { where: { userId: principal.userId }, select: { userId: true } } },
    },
    ticket: { select: ticketRuleSelect(principal) },
  } satisfies Prisma.CommentSelect;
}

/** How the record access loads a comment (§18.3). */
export const commentRecords: RecordDescriptor<'Comment'> = {
  subject: COMMENT,
  async find(db, where, principal) {
    const row = await db.comment.findFirst({ where, select: commentRuleSelect(principal) });
    return row === null ? null : subject(COMMENT, row);
  },
};
