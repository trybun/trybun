import { JsonSyntaxCheck } from './json-syntax.js';

/**
 * The content check of a text format without magic bytes – `txt`, `log`, `csv`, `json`
 * (attachment serving item 1): valid UTF-8, an optional byte order mark, no NUL byte and, for
 * `json`, one JSON value. The content arrives in chunks, so a file is never held in memory.
 */
export class TextContentCheck {
  /** `fatal`: invalid UTF-8 throws instead of becoming U+FFFD; a leading BOM is skipped. */
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });
  private readonly json: JsonSyntaxCheck | undefined;
  private isValid = true;

  constructor({ isJson }: { isJson: boolean }) {
    this.json = isJson ? new JsonSyntaxCheck() : undefined;
  }

  /** Checks the next chunk; returns whether the content is still valid. */
  write(chunk: Uint8Array): boolean {
    // UTF-8 encodes no other character with a zero byte, so the byte is the NUL character.
    this.isValid &&= !chunk.includes(0) && this.decode(chunk, true);
    return this.isValid;
  }

  /** Whether the whole content is valid. */
  end(): boolean {
    this.isValid &&= this.decode(new Uint8Array(0), false) && (this.json?.end() ?? true);
    return this.isValid;
  }

  private decode(chunk: Uint8Array, isStreaming: boolean): boolean {
    let text: string;
    try {
      text = this.decoder.decode(chunk, { stream: isStreaming });
    } catch {
      // The only report of invalid UTF-8 by `TextDecoder`.
      return false;
    }
    return this.json?.write(text) ?? true;
  }
}
