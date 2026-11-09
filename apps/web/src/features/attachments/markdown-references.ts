import type { Attachment } from '@trybun/contracts/attachments';
import { attachmentContentPath, parseAttachmentContentPath } from '@trybun/ui/lib/attachment-path';

/** A stable content path anywhere in a text; `parseAttachmentContentPath` decides what it is. */
const CONTENT_PATH = /\/api\/v1\/attachments\/[^/\s)]+\/content/g;

/**
 * The attachment IDs a Markdown text references through their stable content paths (§13.3), each
 * once, in the order of their first reference.
 */
export function referencedAttachmentIds(markdown: string): string[] {
  const ids = [...markdown.matchAll(CONTENT_PATH)].flatMap(([path]) => {
    const id = parseAttachmentContentPath(path);
    return id === undefined ? [] : [id];
  });
  return [...new Set(ids)];
}

function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * The text without the links and images of an attachment as the editor inserts them
 * (`[name](path)`, `![name](path)`): a reference on a line of its own is removed with its line.
 */
export function withoutAttachmentReferences(markdown: string, id: string): string {
  const reference = String.raw`!?\[(?:\\.|[^\\\]])*\]\(${escapeRegExp(attachmentContentPath(id))}\)`;
  return markdown.replaceAll(new RegExp(String.raw`^${reference}(?:\n|$)|${reference}`, 'gm'), '');
}

/**
 * The IDs of the attachments shown inline in a ticket's Markdown (§13.3): available images of the
 * same ticket; a draft or a file of another ticket stays a link.
 */
export function ticketImageIdsOf(attachments: readonly Attachment[], ticketId: string): string[] {
  return attachments
    .filter(
      (attachment) =>
        attachment.isImage && attachment.status === 'available' && attachment.ticketId === ticketId,
    )
    .map((attachment) => attachment.id);
}
