import { ATTACHMENT_FILE_NAME_MAX_LENGTH } from '@trybun/contracts/attachments';

const CONTROL_CHARACTERS = /\p{Cc}/gu;
const PATH_SEPARATORS = /[/\\]/g;

/**
 * The file name of an attachment from the client's (§13.3): Unicode NFC, control characters
 * removed, `/` and `\` replaced by `_`, trimmed and at most 255 characters – a longer name is
 * shortened before its extension, which it keeps. `null` when nothing is left.
 */
export function normalizeFileName(clientName: string): string | null {
  const name = clientName
    .normalize('NFC')
    .replace(CONTROL_CHARACTERS, '')
    .replace(PATH_SEPARATORS, '_')
    .trim();
  // Code points, so a character outside the Basic Multilingual Plane is never split.
  const characters = Array.from(name);
  if (characters.length === 0) {
    return null;
  }
  if (characters.length <= ATTACHMENT_FILE_NAME_MAX_LENGTH) {
    return name;
  }
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 ? Array.from(name.slice(dot)) : [];
  if (extension.length >= ATTACHMENT_FILE_NAME_MAX_LENGTH) {
    return characters.slice(0, ATTACHMENT_FILE_NAME_MAX_LENGTH).join('');
  }
  const stem = characters.slice(0, ATTACHMENT_FILE_NAME_MAX_LENGTH - extension.length).join('');
  return `${stem.trimEnd()}${extension.join('')}`;
}
