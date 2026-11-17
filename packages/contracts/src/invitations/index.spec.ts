import { describe, expect, it } from 'vitest';
import {
  createInvitationSchema,
  invitationActionSchema,
  invitationStateSchema,
  invitationTargetTypeSchema,
  listInvitationsQuerySchema,
} from './index.js';

describe('invitation enums', () => {
  it.each([
    [invitationTargetTypeSchema, ['project', 'organization', 'administrator']],
    [invitationStateSchema, ['pending', 'accepted', 'revoked', 'expired']],
    [invitationActionSchema, ['resend', 'revoke']],
  ])('lists the glossary codes', (schema, codes) => {
    expect(schema.options).toEqual(codes);
  });
});

describe('createInvitationSchema', () => {
  it('normalizes the e-mail address', () => {
    expect(
      createInvitationSchema.parse({
        email: '  Anna@Firma.example ',
        target: { type: 'administrator' },
      }),
    ).toEqual({ email: 'anna@firma.example', target: { type: 'administrator' } });
  });

  it.each([
    [
      { type: 'project', projectId: '0195f3c2-6b1a-7c3e-9d2f-4a5b6c7d8e9f', role: 'end_user' },
      true,
    ],
    [{ type: 'project', projectId: '0195f3c2-6b1a-7c3e-9d2f-4a5b6c7d8e9f' }, false],
    [{ type: 'organization', organizationId: '0195f3c2-6b1a-7c3e-9d2f-4a5b6c7d8e9f' }, true],
    [{ type: 'everyone' }, false],
  ])('checks the target %o', (target, valid) => {
    expect(createInvitationSchema.safeParse({ email: 'anna@firma.example', target }).success).toBe(
      valid,
    );
  });
});

describe('listInvitationsQuerySchema', () => {
  const a = '0199a3f0-0000-7000-8000-000000000001';
  const b = '0199a3f0-0000-7000-8000-000000000002';

  it.each([
    ['one account', a, [a]],
    ['repeated accounts', [a, b], [a, b]],
  ])('reads userId of %s as a list', (_case, userId, expected) => {
    expect(listInvitationsQuerySchema.parse({ userId }).userId).toEqual(expected);
  });

  it('reads no userId as no narrowing', () => {
    expect(listInvitationsQuerySchema.parse({}).userId).toBeUndefined();
  });
});
