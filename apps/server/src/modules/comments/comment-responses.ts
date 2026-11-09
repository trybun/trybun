import { subject } from '@casl/ability';
import type { Attachment } from '@trybun/contracts/attachments';
import {
  type Comment,
  commentActionSchema,
  type CommentMention,
  type CommentResponse,
  type EndUserComment,
  HIDDEN_MENTION_ID,
} from '@trybun/contracts/comments';
import type { ContentRevisionPage } from '@trybun/contracts/content-revisions';
import { mentionIdsOf } from '@trybun/markdown';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Transaction } from '../../platform/database/prisma.service.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import type { AppAbility } from '../../platform/authorization/ability-factory.js';
import { identitySelect, visiblePerson } from '../users/visible-person.js';
import { COMMENT, commentRuleSelect } from './comments.abilities.js';

/** The fields of a comment response and of its rules (§18.3). */
export function commentSelect(principal: UserPrincipal) {
  const rules = commentRuleSelect(principal);
  return {
    ...rules,
    ticketId: true,
    body: true,
    editedAt: true,
    editedById: true,
    version: true,
    createdAt: true,
    audienceOrganization: {
      select: { ...rules.audienceOrganization.select, id: true, name: true },
    },
    author: { select: identitySelect(principal) },
    mentions: {
      select: { user: { select: identitySelect(principal) } },
      orderBy: { createdAt: 'asc' },
    },
  } satisfies Prisma.CommentSelect;
}

export type CommentRow = Prisma.CommentGetPayload<{ select: ReturnType<typeof commentSelect> }>;

/** The token of a mention in GFM source (S1-12 Q2). */
export function mentionToken(id: string): string {
  return `@{${id}}`;
}

/**
 * The text and the mentions of a comment as the reader may see them (§5.4, S1-12 Q2): a person the
 * identity rule hides reaches the reader as the token `@{customer}` and one map entry without a
 * name, so no hidden user ID leaves the server. The stored text keeps the real IDs.
 */
export function mentionsForReader(
  principal: UserPrincipal,
  body: string,
  people: readonly CommentRow['mentions'][number]['user'][],
): { body: string; mentions: CommentMention[] } {
  let text = body;
  const mentions: CommentMention[] = [];
  let hasHiddenPerson = false;
  for (const person of people) {
    const visible = visiblePerson(principal, person);
    if (visible === null) {
      text = text.replaceAll(mentionToken(person.id), mentionToken(HIDDEN_MENTION_ID));
      hasHiddenPerson = true;
    } else {
      mentions.push(visible);
    }
  }
  if (hasHiddenPerson) {
    mentions.push({ id: HIDDEN_MENTION_ID, displayName: null });
  }
  return { body: text, mentions };
}

/**
 * The response shape of a comment (§18.3) for its reader, with its attachments and the actions the
 * principal may perform: the team's shape with the kind and the audience, the end user's without
 * them, the author under the identity rule (§5.4).
 */
export function toCommentResponse(
  row: CommentRow,
  ability: AppAbility,
  principal: UserPrincipal,
  attachments: readonly Attachment[],
): CommentResponse {
  const record = subject(COMMENT, row);
  const { body, mentions } = mentionsForReader(
    principal,
    row.body,
    row.mentions.map(({ user }) => user),
  );
  const common = {
    id: row.id,
    ticketId: row.ticketId,
    author: visiblePerson(principal, row.author),
    body,
    mentions,
    attachments: [...attachments],
    editedAt: row.editedAt?.toISOString() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    allowedActions: commentActionSchema.options.filter((action) => ability.can(action, record)),
  };
  if (principal.userKind === 'end_user') {
    return common satisfies EndUserComment;
  }
  return {
    ...common,
    kind: row.kind,
    audience: row.audience,
    audienceOrganization:
      row.audienceOrganization === null
        ? null
        : { id: row.audienceOrganization.id, name: row.audienceOrganization.name },
  } satisfies Comment;
}

/**
 * The earlier versions of a text as the reader may see their mentions (§5.4, S1-12): each body
 * names its own people, who may differ from the current text's; a person the identity rule hides
 * becomes `@{customer}`, so no hidden user ID leaves the server.
 */
export async function revisionsForReader(
  db: Transaction,
  principal: UserPrincipal,
  page: ContentRevisionPage,
): Promise<ContentRevisionPage> {
  const ids = [...new Set(page.items.flatMap((revision) => mentionIdsOf(revision.body)))];
  const people =
    ids.length === 0
      ? []
      : await db.user.findMany({ where: { id: { in: ids } }, select: identitySelect(principal) });
  const byId = new Map(people.map((person) => [person.id, person]));
  return {
    ...page,
    items: page.items.map((revision) => {
      const mentioned = mentionIdsOf(revision.body).flatMap((id) => byId.get(id) ?? []);
      return { ...revision, ...mentionsForReader(principal, revision.body, mentioned) };
    }),
  };
}
