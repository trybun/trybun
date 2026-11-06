import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { toFieldErrorCode } from '../problem-details/index.js';
import {
  addTicketAttachmentsSchema,
  attachmentActionSchema,
  attachmentStatusSchema,
  listAttachmentsQuerySchema,
} from './index.js';

const ID = '0190f2f4-7c1e-7000-8000-000000000001';

/** The field error codes of a request schema, by pointer. */
function fieldErrors(result: z.ZodSafeParseResult<unknown>) {
  return (result.error?.issues ?? []).map((issue) => [
    `/${issue.path.map(String).join('/')}`,
    toFieldErrorCode(issue),
  ]);
}

describe('attachment enums', () => {
  it.each([
    [attachmentStatusSchema, ['quarantine', 'available', 'infected', 'rejected']],
    [attachmentActionSchema, ['read', 'delete']],
  ])('%#: has the glossary codes', (schema, values) => {
    expect(schema.options).toEqual(values);
  });
});

describe('listAttachmentsQuerySchema', () => {
  it.each([
    ['one ID as a string', ID, [ID]],
    ['several IDs', [ID, ID], [ID, ID]],
  ])('accepts %s', (_case, id, expected) => {
    expect(listAttachmentsQuerySchema.parse({ id })).toEqual({ id: expected });
  });

  it.each([
    ['no ID', {}, [['/id', 'field.invalid']]],
    ['an empty list', { id: [] }, [['/id', 'array.too_short']]],
    ['51 IDs', { id: Array<string>(51).fill(ID) }, [['/id', 'array.too_long']]],
    ['an ID that is not a UUID', { id: 'x' }, [['/id', 'field.invalid']]],
  ])('refuses %s', (_case, query, errors) => {
    expect(fieldErrors(listAttachmentsQuerySchema.safeParse(query))).toEqual(errors);
  });
});

describe('addTicketAttachmentsSchema', () => {
  it('accepts 1 to 100 IDs', () => {
    expect(addTicketAttachmentsSchema.safeParse({ attachmentIds: [ID] }).success).toBe(true);
    expect(
      addTicketAttachmentsSchema.safeParse({ attachmentIds: Array<string>(100).fill(ID) }).success,
    ).toBe(true);
  });

  it.each([
    ['no ID', { attachmentIds: [] }, [['/attachmentIds', 'array.too_short']]],
    [
      '101 IDs',
      { attachmentIds: Array<string>(101).fill(ID) },
      [['/attachmentIds', 'array.too_long']],
    ],
    [
      'an ID that is not a UUID',
      { attachmentIds: ['x'] },
      [['/attachmentIds/0', 'string.invalid_format']],
    ],
    ['an unknown field', { attachmentIds: [ID], ticketId: ID }, [['/', 'field.unrecognized']]],
  ])('refuses %s', (_case, body, errors) => {
    expect(fieldErrors(addTicketAttachmentsSchema.safeParse(body))).toEqual(errors);
  });
});
