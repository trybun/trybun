import { describe, expect, it } from 'vitest';
import { attachmentResponse } from '../../../test/factories/attachment.factory.js';
import {
  referencedAttachmentIds,
  ticketImageIdsOf,
  withoutAttachmentReferences,
} from './markdown-references.js';

const A = '0199a3f0-0000-7000-8000-0000000000a1';
const B = '0199a3f0-0000-7000-8000-0000000000b2';
const TICKET = '0199a3f0-0000-7000-8000-000000000020';

describe('referencedAttachmentIds', () => {
  it.each([
    ['', []],
    [`![shot](/api/v1/attachments/${A}/content)`, [A]],
    [`[log](/api/v1/attachments/${A}/content) and ![](/api/v1/attachments/${B}/content)`, [A, B]],
    [`![a](/api/v1/attachments/${A}/content) ![again](/api/v1/attachments/${A}/content)`, [A]],
    // Only the exact stable path of a lower-case UUID is an attachment.
    [`![x](/api/v1/attachments/${A.toUpperCase()}/content)`, []],
    ['![x](/api/v1/attachments/not-an-id/content)', []],
    ['![x](https://example.com/image.png)', []],
  ])('finds the attachments of %j', (markdown, ids) => {
    expect(referencedAttachmentIds(markdown)).toEqual(ids);
  });
});

describe('withoutAttachmentReferences', () => {
  const link = `[log\\.txt](/api/v1/attachments/${A}/content)`;
  const image = `![shot\\.png](/api/v1/attachments/${A}/content)`;
  const other = `![other\\.png](/api/v1/attachments/${B}/content)`;

  it.each([
    [`Before\n${image}\nAfter`, 'Before\nAfter'],
    [`Before\n${link}`, 'Before\n'],
    [`See ${link} here`, 'See  here'],
    [`${image}\n${other}`, other],
    [`${image}\nText\n${image}`, 'Text\n'],
    [`Escaped [br\\]acket](/api/v1/attachments/${A}/content)`, 'Escaped '],
    [other, other],
  ])('removes the references of the attachment from %j', (markdown, expected) => {
    expect(withoutAttachmentReferences(markdown, A)).toBe(expected);
  });
});

describe('ticketImageIdsOf', () => {
  it('keeps the available images of the same ticket', () => {
    const attachments = [
      attachmentResponse({ id: A, isImage: true, status: 'available', ticketId: TICKET }),
      attachmentResponse({ id: B, isImage: true, status: 'quarantine', ticketId: TICKET }),
      attachmentResponse({ isImage: false, status: 'available', ticketId: TICKET }),
      attachmentResponse({ isImage: true, status: 'available', ticketId: null }),
      attachmentResponse({
        isImage: true,
        status: 'available',
        ticketId: '0199a3f0-0000-7000-8000-000000000099',
      }),
    ];

    expect(ticketImageIdsOf(attachments, TICKET)).toEqual([A]);
  });
});
