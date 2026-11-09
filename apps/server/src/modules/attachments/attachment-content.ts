import { Readable } from 'node:stream';
import { fileTypeFromStream } from 'file-type';
import yauzl from 'yauzl';
import { AppError } from '../../platform/errors/app-error.js';
import type { ObjectStorage } from '../../platform/storage/object-storage.js';
import type { AllowlistEntry } from './domain/allowlist.js';
import { PdfEncryptionScan } from './domain/pdf-encryption.js';
import { TextContentCheck } from './domain/text-content.js';

/**
 * Bytes one ranged request of the ZIP check reads: yauzl reads the central directory in small
 * pieces, which a block serves from memory instead of one request each.
 */
const ZIP_BLOCK_SIZE = 256 * 1024;

/** The content of a stored object; a missing object is a storage failure. */
async function contentOf(
  storage: ObjectStorage,
  key: string,
  range?: { start: number; end: number },
) {
  const content = await storage.get(key, range);
  if (content === null) {
    throw new AppError('server.unavailable');
  }
  return content;
}

/**
 * The format `file-type` detects from the magic bytes of an object; it reads only the bytes it
 * needs, then the body is closed (ADR 0008).
 */
async function detectFormat(storage: ObjectStorage, key: string): Promise<string | undefined> {
  const { body } = await contentOf(storage, key);
  try {
    return (await fileTypeFromStream(Readable.toWeb(body)))?.ext;
  } finally {
    body.destroy();
  }
}

/** Feeds the chunks of an object to `consume` until it returns `false` or the object ends. */
async function readChunks(
  storage: ObjectStorage,
  key: string,
  consume: (chunk: Buffer) => boolean,
): Promise<void> {
  const { body } = await contentOf(storage, key);
  for await (const chunk of body as AsyncIterable<Buffer>) {
    if (!consume(chunk)) {
      // Leaving the loop destroys the body.
      return;
    }
  }
}

/**
 * The random access of yauzl over ranged `GetObject` requests (ADR 0008), with one block of the
 * object in memory: yauzl reads only the end record and the central directory, front to back.
 */
class StorageZipReader extends yauzl.RandomAccessReader {
  private block: { start: number; data: Buffer } | undefined;

  constructor(
    private readonly storage: ObjectStorage,
    private readonly key: string,
    private readonly size: number,
  ) {
    super();
  }

  override read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    callback: (error: Error | null, bytesRead?: number) => void,
  ): void {
    this.readRange(position, length).then(
      (data) => {
        data.copy(buffer, offset);
        callback(null, data.length);
      },
      (error: unknown) => {
        callback(error instanceof Error ? error : new Error('ZIP read failed'));
      },
    );
  }

  private async readRange(position: number, length: number): Promise<Buffer> {
    const end = Math.min(position + length, this.size);
    if (end <= position) {
      return Buffer.alloc(0);
    }
    const cached = this.block;
    if (
      cached === undefined ||
      position < cached.start ||
      end > cached.start + cached.data.length
    ) {
      const blockEnd = Math.min(position + Math.max(length, ZIP_BLOCK_SIZE), this.size);
      const { body } = await contentOf(this.storage, this.key, {
        start: position,
        end: blockEnd - 1,
      });
      const chunks: Buffer[] = [];
      for await (const chunk of body as AsyncIterable<Buffer>) {
        chunks.push(chunk);
      }
      this.block = { start: position, data: Buffer.concat(chunks) };
    }
    const { start, data } = this.block ?? { start: position, data: Buffer.alloc(0) };
    return data.subarray(position - start, end - start);
  }
}

/**
 * Whether a ZIP archive is readable and has no encrypted entry (§13.3): ClamAV cannot scan the
 * content of an encrypted entry. Only the central directory is read; an archive yauzl cannot read
 * is not a ZIP archive.
 */
async function isReadableUnencryptedZip(
  storage: ObjectStorage,
  key: string,
  size: number,
): Promise<boolean> {
  let zip: yauzl.ZipFile;
  try {
    zip = await yauzl.fromRandomAccessReaderPromise(
      new StorageZipReader(storage, key, size),
      size,
      {
        // The names are not needed, so names a ZIP tool would refuse do not reject the archive.
        decodeStrings: false,
      },
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    return false;
  }
  try {
    for await (const entry of zip.eachEntry()) {
      if (entry.isEncrypted()) {
        return false;
      }
    }
    return true;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    return false;
  } finally {
    zip.close();
  }
}

/**
 * Whether the content of a stored file belongs to the allowlist entry of its extension (§13.3,
 * ADR 0008, attachment serving items 1 and 6): a binary format must be the one `file-type` detects
 * – a ZIP archive without encrypted entries, a PDF file without encryption; a text format must be
 * no detected binary format and valid text.
 */
export async function contentMatches(
  storage: ObjectStorage,
  key: string,
  size: number,
  entry: AllowlistEntry,
): Promise<boolean> {
  const format = await detectFormat(storage, key);
  if (entry.kind === 'text') {
    if (format !== undefined) {
      return false;
    }
    const check = new TextContentCheck({ isJson: entry.isJson });
    await readChunks(storage, key, (chunk) => check.write(chunk));
    return check.end();
  }
  if (format !== entry.format) {
    return false;
  }
  if (entry.format === 'pdf') {
    const scan = new PdfEncryptionScan();
    await readChunks(storage, key, (chunk) => !scan.write(chunk));
    return !scan.isEncrypted;
  }
  return entry.format === 'zip' ? isReadableUnencryptedZip(storage, key, size) : true;
}
