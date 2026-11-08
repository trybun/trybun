import { describe, expect, it } from 'vitest';
import { linkFailure } from './linking.js';

const [A, B, C] = [
  '0190f2f4-7c1e-7000-8000-000000000001',
  '0190f2f4-7c1e-7000-8000-000000000002',
  '0190f2f4-7c1e-7000-8000-000000000003',
];

describe('linkFailure (§13.3, Q4, Q11)', () => {
  it('answers 404 for an ID the principal cannot read, before an already linked one', () => {
    const error = linkFailure([A, B, C], new Set([A]), new Set([A, B]));

    expect(error).toMatchObject({ code: 'request.not_found', errors: undefined });
  });

  it('points at the first attachment already linked', () => {
    const error = linkFailure([A, B, C], new Set([A]), new Set([A, B, C]));

    expect(error).toMatchObject({
      code: 'attachment.already_linked',
      errors: [{ pointer: '/attachmentIds/1', code: 'field.invalid' }],
    });
  });

  it('refuses to classify a link that linked every draft', () => {
    expect(() => linkFailure([A], new Set([A]), new Set([A]))).toThrow();
  });
});
