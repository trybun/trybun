// The stable path of an attachment's content (§13.3, ADR 0008), the only image source a renderer
// shows as an image.

const ATTACHMENT_CONTENT_PATH =
  /^\/api\/v1\/attachments\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\/content$/;

/** The relative stable path of the content of the attachment with the given ID. */
export function attachmentContentPath(id: string): string {
  return `/api/v1/attachments/${id}/content`;
}

/**
 * The attachment ID of a stable content path, or `undefined` for any other URL. The path must
 * match exactly: relative, a lower-case UUID, nothing before or after it.
 */
export function parseAttachmentContentPath(url: string): string | undefined {
  return ATTACHMENT_CONTENT_PATH.exec(url)?.[1];
}
