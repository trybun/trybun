import { pipeline, Transform } from 'node:stream';
import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { StorageEngine } from 'multer';
import { newId } from '../../platform/database/ids.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
  quarantineKey,
} from '../../platform/storage/object-storage.js';

/** A file of an upload as the storage engine stored it in quarantine (ADR 0008). */
export interface QuarantinedFile {
  /** The ID of the attachment, generated before the upload; the key of its object. */
  attachmentId: string;
  /** The file name sent by the client, not normalized. Never logged (§13.5). */
  originalName: string;
  /** The bytes stored. */
  size: number;
}

/** The ID the storage engine gave a file; none for a file it did not store. */
function attachmentIdOf(file: Express.Multer.File): string | undefined {
  return 'attachmentId' in file && typeof file.attachmentId === 'string'
    ? file.attachmentId
    : undefined;
}

/** The files of an upload as the storage engine stored them, for the attachments service. */
export function quarantinedFiles(files: readonly Express.Multer.File[]): QuarantinedFile[] {
  return files.flatMap((file) => {
    const attachmentId = attachmentIdOf(file);
    return attachmentId === undefined
      ? []
      : [{ attachmentId, originalName: file.originalname, size: file.size }];
  });
}

/**
 * The custom multer storage engine of the attachments (ADR 0008): it streams each file of an
 * upload to `quarantine/{id}` of the object storage under a new UUIDv7 – the key never contains
 * the file name – and counts its bytes. Multer removes the stored objects of a request that fails
 * while it streams, e.g. a file over the size limit or one file too many.
 */
@Injectable()
export class QuarantineStorageEngine implements StorageEngine {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  _handleFile(
    _request: Request,
    file: Express.Multer.File,
    callback: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ): void {
    const attachmentId = newId();
    let size = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, next) {
        size += chunk.length;
        next(null, chunk);
      },
    });
    // An error of the file stream, e.g. a malformed request, fails the upload of the counter.
    pipeline(file.stream, counter, () => undefined);
    this.storage.put(quarantineKey(attachmentId), counter).then(
      () => {
        const info: Partial<Express.Multer.File> & Pick<QuarantinedFile, 'attachmentId'> = {
          attachmentId,
          size,
        };
        callback(null, info);
      },
      (error: unknown) => {
        callback(error);
      },
    );
  }

  _removeFile(
    _request: Request,
    file: Express.Multer.File,
    callback: (error: Error | null) => void,
  ): void {
    const attachmentId = attachmentIdOf(file);
    if (attachmentId === undefined) {
      callback(null);
      return;
    }
    this.storage.delete(quarantineKey(attachmentId)).then(
      () => {
        callback(null);
      },
      (error: unknown) => {
        callback(error instanceof Error ? error : new Error('Object storage delete failed'));
      },
    );
  }
}
