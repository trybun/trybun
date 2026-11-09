import type { Attachment } from '@trybun/contracts/attachments';

/** An attachment response of the API (§13.3) for component tests: a draft in quarantine. */
export function attachmentResponse(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: '0199a3f0-0000-7000-8000-0000000000a1',
    fileName: 'log.txt',
    contentType: 'text/plain',
    size: 1_024,
    isImage: false,
    status: 'quarantine',
    ticketId: null,
    commentId: null,
    uploadedBy: { id: '0199a3f0-0000-7000-8000-000000000030', displayName: 'Celina Customer' },
    createdAt: '2026-11-06T09:00:00.000Z',
    allowedActions: ['read', 'delete'],
    ...overrides,
  };
}
