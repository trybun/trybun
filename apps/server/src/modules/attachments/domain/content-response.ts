import type { AttachmentStatus } from '@trybun/contracts/attachments';
import { AppError } from '../../../platform/errors/app-error.js';

/**
 * The headers every content response forces (§13.3, ADR 0008, attachment serving item 4): a file
 * opened directly in a tab runs no script and no other site embeds it; the browser never guesses
 * another type, and no shared cache keeps the file of one person.
 */
export const FORCED_CONTENT_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'private',
} as const;

/**
 * The content of an attachment is available only after the scan (attachment serving item 3):
 * `409 attachment.not_available` while it is checked, `410 attachment.removed` once it was removed.
 */
export function assertContentAvailable(status: AttachmentStatus): void {
  if (status === 'quarantine') {
    throw new AppError('attachment.not_available');
  }
  if (status !== 'available') {
    throw new AppError('attachment.removed');
  }
}

/** The content of an ID never changes once it is available, so the ID is its strong ETag. */
export function contentETag(attachmentId: string): string {
  return `"${attachmentId}"`;
}

/** The request headers of a conditional `GET` (RFC 9110, section 13.1.2). */
export interface ConditionalHeaders {
  ifNoneMatch: string | undefined;
  ifModifiedSince: string | undefined;
  cacheControl: string | undefined;
}

/**
 * Whether a conditional `GET` is answered with `304` (RFC 9110, section 13.1.2): `If-None-Match` is `*` or
 * lists the ETag, compared weakly. A request that forbids a stored answer (`Cache-Control:
 * no-cache`) or asks `If-Modified-Since` – the API sends no `Last-Modified` – gets the content, as
 * Express decides for the `304` it sends (`req.fresh`).
 */
export function isNotModified(headers: ConditionalHeaders, etag: string): boolean {
  const { ifNoneMatch, ifModifiedSince, cacheControl } = headers;
  if (ifNoneMatch === undefined || ifModifiedSince !== undefined) {
    return false;
  }
  if (cacheControl !== undefined && /(?:^|,)\s*no-cache\s*(?:,|$)/i.test(cacheControl)) {
    return false;
  }
  if (ifNoneMatch.trim() === '*') {
    return true;
  }
  const opaque = (tag: string) => tag.trim().replace(/^W\//, '');
  return ifNoneMatch.split(',').some((tag) => opaque(tag) === opaque(etag));
}

/** RFC 8187: every byte outside `attr-char` is percent-encoded, in UTF-8. */
function extendedValue(value: string): string {
  return `UTF-8''${encodeURIComponent(value).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )}`;
}

/**
 * The `Content-Disposition` of a file (§13.3, ADR 0008): raster images open inline, every other
 * file downloads. The file name goes as an ASCII `filename` – other characters, quotes and
 * backslashes replaced by `_` – and as the exact UTF-8 `filename*` of RFC 8187, which browsers
 * prefer.
 */
export function contentDisposition(fileName: string, isImage: boolean): string {
  // The normalized file name holds no control characters (§13.3).
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${isImage ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=${extendedValue(fileName)}`;
}
