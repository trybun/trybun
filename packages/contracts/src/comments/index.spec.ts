import { describe, expect, it } from 'vitest';
import { toFieldErrorCode } from '../problem-details/index.js';
import {
  COMMENT_BODY_MAX_LENGTH,
  commentActionSchema,
  commentKindSchema,
  commentMentionSchema,
  commentResponseSchema,
  createCommentSchema,
  mentionCandidatesSchema,
  redactCommentSchema,
  timelineItemSchema,
  updateCommentSchema,
} from './index.js';

const ID = '0190f2f4-7c1e-7000-8000-000000000001';

const common = {
  id: ID,
  ticketId: ID,
  author: { id: ID, displayName: 'Ewa' },
  body: 'Thanks @{0190f2f4-7c1e-7000-8000-000000000001}',
  mentions: [{ id: ID, displayName: 'Ewa' }],
  attachments: [],
  editedAt: null,
  version: 1,
  createdAt: '2026-11-09T10:00:00.000Z',
  allowedActions: ['read'],
};

describe('comment enums', () => {
  it.each([
    [commentKindSchema, ['public', 'internal']],
    [commentActionSchema, ['read', 'update', 'delete', 'redact', 'read_revisions']],
  ])('lists the codes', (schema, codes) => {
    expect(schema.options).toEqual(codes);
  });
});

describe('createCommentSchema', () => {
  it('trims the text and accepts own drafts', () => {
    expect(
      createCommentSchema.parse({ kind: 'internal', body: '  Looks good ', attachmentIds: [ID] }),
    ).toEqual({ kind: 'internal', body: 'Looks good', attachmentIds: [ID] });
  });

  it.each([
    [{ kind: 'public', body: '   ' }, '/body', 'string.empty'],
    [{ kind: 'public', body: 'x'.repeat(COMMENT_BODY_MAX_LENGTH + 1) }, '/body', 'string.too_long'],
    [{ kind: 'note', body: 'Hi' }, '/kind', 'field.invalid_value'],
    [{ body: 'Hi' }, '/kind', 'field.invalid_value'],
  ])('rejects %j at %s with %s', (input, pointer, code) => {
    const result = createCommentSchema.safeParse(input);

    expect(result.success).toBe(false);
    const issue = result.error?.issues[0];
    expect((issue?.path ?? []).map((key) => `/${String(key)}`).join('')).toBe(pointer);
    expect(issue === undefined ? undefined : toFieldErrorCode(issue)).toBe(code);
  });

  it('never accepts a kind in an edit (S1-12 Q12)', () => {
    expect(updateCommentSchema.safeParse({ body: 'Hi', kind: 'public' }).success).toBe(false);
  });
});

describe('redactCommentSchema', () => {
  it('limits the purged revisions to 1000', () => {
    expect(
      redactCommentSchema.safeParse({ body: 'x', purgeRevisionIds: Array(1001).fill(ID) }).success,
    ).toBe(false);
    expect(redactCommentSchema.safeParse({ body: 'x', purgeRevisionIds: [] }).success).toBe(true);
  });
});

describe('mentionCandidatesSchema', () => {
  it('accepts an empty query and refuses more than 100 characters', () => {
    expect(mentionCandidatesSchema.parse({ kind: 'public', query: '' })).toEqual({
      kind: 'public',
      query: '',
    });
    expect(
      mentionCandidatesSchema.safeParse({ kind: 'public', query: 'x'.repeat(101) }).success,
    ).toBe(false);
  });
});

describe('commentMentionSchema', () => {
  it('accepts a user ID or the hidden person (§5.4)', () => {
    expect(commentMentionSchema.safeParse({ id: ID, displayName: 'Ewa' }).success).toBe(true);
    expect(
      commentMentionSchema.safeParse({ id: 'customer', displayName: 'Customer' }).success,
    ).toBe(true);
    expect(commentMentionSchema.safeParse({ id: 'someone', displayName: 'X' }).success).toBe(false);
  });
});

describe('commentResponseSchema', () => {
  it('keeps the kind and the audience of a team comment', () => {
    const comment = {
      ...common,
      kind: 'public',
      audience: 'my_organization',
      audienceOrganization: { id: ID, name: 'Acme' },
    };

    expect(commentResponseSchema.parse(comment)).toEqual(comment);
  });

  it("strips the kind and the audience from an end user's comment", () => {
    expect(commentResponseSchema.options[1].parse({ ...common, kind: 'internal' })).toEqual(common);
  });
});

describe('timelineItemSchema', () => {
  it('holds a comment or an event', () => {
    expect(
      timelineItemSchema.parse({
        type: 'event',
        event: {
          id: ID,
          type: 'comment_deleted',
          data: { commentId: ID, kind: 'public' },
          actor: { id: ID, displayName: 'Ewa' },
          automaticSource: null,
          createdAt: '2026-11-09T10:00:00.000Z',
        },
      }),
    ).toMatchObject({ type: 'event', event: { data: { commentId: ID, kind: 'public' } } });
  });
});
