/** PDF whitespace (ISO 32000-1, 7.2.2): NUL, tab, line feed, form feed, carriage return, space. */
const WHITESPACE = '[\\0\\t\\n\\f\\r ]';

/**
 * The name `/Encrypt`, each character also written as a `#xx` escape, which PDF names allow
 * (ISO 32000-1, 7.3.5).
 */
const ENCRYPT_NAME = Array.from('Encrypt', (character) => {
  const hex = character.charCodeAt(0).toString(16);
  const hexPattern = Array.from(hex, (digit) => `[${digit.toLowerCase()}${digit.toUpperCase()}]`);
  return `(?:${character}|#${hexPattern.join('')})`;
}).join('');

/**
 * The `/Encrypt` entry of a trailer or of a cross-reference stream (ISO 32000-1, 7.5.5, 7.6.1): a
 * reference to the encryption dictionary (`/Encrypt 12 0 R`) or the dictionary itself. Dictionary
 * keys are never encrypted, so the entry is plain text in every encrypted file.
 */
const ENCRYPT_ENTRY = new RegExp(
  `/${ENCRYPT_NAME}${WHITESPACE}*(?:\\d+${WHITESPACE}+\\d+${WHITESPACE}+R|<<)`,
);

/** Characters kept from the end of a chunk, so an entry split between two chunks is found. */
const OVERLAP = 256;

/**
 * Whether a PDF file is encrypted (attachment serving item 6): ClamAV cannot scan its content, so
 * it is rejected like an encrypted ZIP archive. The content arrives in chunks, so a file is never
 * held in memory.
 */
export class PdfEncryptionScan {
  private tail = '';
  isEncrypted = false;

  /** Scans the next chunk; returns whether the file is known to be encrypted. */
  write(chunk: Uint8Array): boolean {
    if (!this.isEncrypted) {
      // Latin-1 maps every byte to one character, so the text keeps the positions of the bytes.
      const text =
        this.tail +
        Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).toString('latin1');
      this.isEncrypted = ENCRYPT_ENTRY.test(text);
      this.tail = text.slice(-OVERLAP);
    }
    return this.isEncrypted;
  }
}
