/**
 * The formats `file-type` detects from the content of an allowlisted file (ADR 0008), by the
 * extension they report; `jpg` and `jpeg` are one format.
 */
export type DetectedFormat =
  'png' | 'jpg' | 'gif' | 'webp' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'odt' | 'ods' | 'zip';

/**
 * An entry of the allowlist (§13.3): the content type the download is served with (never the one
 * sent by the client) and how the content is checked – a binary format detected from its magic
 * bytes, or text without magic bytes (attachment serving item 1).
 */
export type AllowlistEntry =
  | { kind: 'binary'; format: DetectedFormat; contentType: string }
  | { kind: 'text'; isJson: boolean; contentType: string };

function binary(format: DetectedFormat, contentType: string): AllowlistEntry {
  return { kind: 'binary', format, contentType };
}

function text(contentType: string, isJson = false): AllowlistEntry {
  return { kind: 'text', isJson, contentType };
}

/** The raster images, the only files shown inline (§13.3). */
const RASTER_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

/** The fixed allowlist of extensions (§13.3). */
const ALLOWLIST: ReadonlyMap<string, AllowlistEntry> = new Map([
  ['png', binary('png', 'image/png')],
  ['jpg', binary('jpg', 'image/jpeg')],
  ['jpeg', binary('jpg', 'image/jpeg')],
  ['gif', binary('gif', 'image/gif')],
  ['webp', binary('webp', 'image/webp')],
  ['pdf', binary('pdf', 'application/pdf')],
  ['txt', text('text/plain; charset=utf-8')],
  ['log', text('text/plain; charset=utf-8')],
  ['csv', text('text/csv; charset=utf-8')],
  ['json', text('application/json', true)],
  [
    'docx',
    binary('docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  ],
  ['xlsx', binary('xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')],
  [
    'pptx',
    binary('pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'),
  ],
  ['odt', binary('odt', 'application/vnd.oasis.opendocument.text')],
  ['ods', binary('ods', 'application/vnd.oasis.opendocument.spreadsheet')],
  ['zip', binary('zip', 'application/zip')],
]);

/**
 * The extension of a file name in lower case: the text after its last dot. A name without one, or
 * whose only dot starts it (`.png`), has none.
 */
export function extensionOf(fileName: string): string | undefined {
  const dot = fileName.lastIndexOf('.');
  return dot <= 0 ? undefined : fileName.slice(dot + 1).toLowerCase();
}

/** The allowlist entry of a file name's extension; none when the type is not allowed (§13.3). */
export function allowlistEntryOf(fileName: string): AllowlistEntry | undefined {
  const extension = extensionOf(fileName);
  return extension === undefined ? undefined : ALLOWLIST.get(extension);
}

/** Whether an attachment of this content type is a raster image, shown inline (§13.3). */
export function isRasterImage(contentType: string): boolean {
  return RASTER_IMAGE_TYPES.has(contentType);
}
