import type { Readable } from 'node:stream';

/** The prefix of uploaded files before the malware scan, read only by the Worker (ADR 0008). */
export const QUARANTINE_PREFIX = 'quarantine/';

/** The prefix of scanned files, the only one the content endpoint reads (ADR 0008). */
export const AVAILABLE_PREFIX = 'available/';

/** The key of an attachment in quarantine; the key never contains the file name (ADR 0008). */
export function quarantineKey(attachmentId: string): string {
  return `${QUARANTINE_PREFIX}${attachmentId}`;
}

/** The key of a scanned attachment (ADR 0008). */
export function availableKey(attachmentId: string): string {
  return `${AVAILABLE_PREFIX}${attachmentId}`;
}

/** Bytes `start` to `end` of an object, both inclusive, as in an HTTP `Range` header. */
export interface ByteRange {
  start: number;
  end: number;
}

/** The content of an object; the reader consumes or destroys `body`. */
export interface ObjectContent {
  body: Readable;
  /** The number of bytes of `body`: the object's size, or the length of the range. */
  size: number;
}

/** An object as `head` and `list` report it. */
export interface ObjectInfo {
  /** Relative to the folder of the storage configuration, e.g. `quarantine/{id}`. */
  key: string;
  size: number;
  lastModified: Date;
}

/**
 * The object storage of the attachments (§14.2, ADR 0008), an external service (§18.3): SeaweedFS
 * of Compose or an external S3-compatible storage (§15.3). Keys are relative to the folder of
 * `TRYBUN_S3_URL`, built with `quarantineKey` and `availableKey`. Every method throws
 * `server.unavailable` when the storage fails.
 */
export interface ObjectStorage {
  /**
   * Streams a body of unknown length into an object, replacing an existing one. When the body
   * fails, its error is thrown and nothing is stored.
   */
  put(key: string, body: Readable): Promise<void>;
  /** The content of an object or of a range of it; `null` when the object does not exist. */
  get(key: string, range?: ByteRange): Promise<ObjectContent | null>;
  /** The size and date of an object; `null` when it does not exist. */
  head(key: string): Promise<ObjectInfo | null>;
  /** Copies an object inside the storage, replacing the target. */
  copy(sourceKey: string, targetKey: string): Promise<void>;
  /** Deletes an object; a missing object is ignored. */
  delete(key: string): Promise<void>;
  /** The objects whose keys start with the prefix, e.g. `QUARANTINE_PREFIX`. */
  list(prefix: string): AsyncIterable<ObjectInfo>;
  /**
   * Creates the bucket when it is missing (§15.3). Returns whether the bucket exists; a refusal
   * or an outage is logged as a warning and returns `false`.
   */
  ensureBucket(): Promise<boolean>;
  /** Whether the bucket answers, for the readiness of the API (§17.2); never throws. */
  isAvailable(signal: AbortSignal): Promise<boolean>;
}

export const OBJECT_STORAGE = Symbol('ObjectStorage');
