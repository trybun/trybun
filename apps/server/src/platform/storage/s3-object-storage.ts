import { Readable } from 'node:stream';
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  paginateListObjectsV2,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TRYBUN_CONFIG } from '../config/config.module.js';
import type { TrybunConfig } from '../config/config.schema.js';
import { AppError } from '../errors/app-error.js';
import type { ByteRange, ObjectContent, ObjectInfo, ObjectStorage } from './object-storage.js';

/**
 * Parts of a streamed upload and how many are sent at once: the API holds at most
 * `PART_SIZE * QUEUE_SIZE` bytes of an upload in memory (ADR 0008, 5 MB is the minimum of S3).
 */
const PART_SIZE = 5 * 1024 * 1024;
const QUEUE_SIZE = 2;

/** An unreachable storage fails fast instead of holding a request (§17.2). */
const CONNECTION_TIMEOUT_MS = 5_000;

function isNotFound(error: unknown): boolean {
  return error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'Unknown';
}

/**
 * The object storage over the S3 API (§15.3): path-style requests, which SeaweedFS needs and
 * S3-compatible providers support, into the bucket and folder of `TRYBUN_S3_URL`.
 */
@Injectable()
export class S3ObjectStorage implements ObjectStorage, OnModuleDestroy {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly folder: string;

  constructor(
    @Inject(TRYBUN_CONFIG) config: TrybunConfig,
    @InjectPinoLogger(S3ObjectStorage.name) private readonly logger: PinoLogger,
  ) {
    const { endpoint, bucket, folder, region, accessKeyId, secretAccessKey } = config.storage;
    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
      // Checksums only where S3 requires them: not every S3-compatible storage supports the
      // default CRC32 checksums of the SDK.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      requestHandler: { connectionTimeout: CONNECTION_TIMEOUT_MS },
    });
    this.bucket = bucket;
    this.folder = folder === '' ? '' : `${folder}/`;
  }

  async put(key: string, body: Readable): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: this.objectKey(key), Body: body },
      partSize: PART_SIZE,
      queueSize: QUEUE_SIZE,
    });
    try {
      await upload.done();
    } catch (error) {
      // The error of the body (e.g. the size limit of the upload) is the caller's.
      if (body.errored) {
        throw body.errored;
      }
      throw this.unavailable('put', error);
    }
  }

  async get(key: string, range?: ByteRange): Promise<ObjectContent | null> {
    try {
      const { Body, ContentLength } = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.objectKey(key),
          Range: range && `bytes=${range.start}-${range.end}`,
        }),
      );
      if (!(Body instanceof Readable) || ContentLength === undefined) {
        throw new Error('GetObject returned no stream');
      }
      return { body: Body, size: ContentLength };
    } catch (error) {
      if (error instanceof S3ServiceException && error.name === 'NoSuchKey') {
        return null;
      }
      throw this.unavailable('get', error);
    }
  }

  async head(key: string): Promise<ObjectInfo | null> {
    try {
      const { ContentLength, LastModified } = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
      );
      return { key, size: ContentLength ?? 0, lastModified: LastModified ?? new Date(0) };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw this.unavailable('head', error);
    }
  }

  async copy(sourceKey: string, targetKey: string): Promise<void> {
    // CopySource is `bucket/key`, URL-encoded except for the slashes.
    const source = `${this.bucket}/${this.objectKey(sourceKey).split('/').map(encodeURIComponent).join('/')}`;
    try {
      await this.client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          Key: this.objectKey(targetKey),
          CopySource: source,
        }),
      );
    } catch (error) {
      throw this.unavailable('copy', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
      );
    } catch (error) {
      if (isNotFound(error)) {
        return;
      }
      throw this.unavailable('delete', error);
    }
  }

  async *list(prefix: string): AsyncIterable<ObjectInfo> {
    const pages = paginateListObjectsV2(
      { client: this.client },
      { Bucket: this.bucket, Prefix: this.objectKey(prefix) },
    );
    try {
      for await (const page of pages) {
        for (const { Key, Size, LastModified } of page.Contents ?? []) {
          if (Key !== undefined) {
            yield {
              key: Key.slice(this.folder.length),
              size: Size ?? 0,
              lastModified: LastModified ?? new Date(0),
            };
          }
        }
      }
    } catch (error) {
      throw this.unavailable('list', error);
    }
  }

  async ensureBucket(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch (error) {
      if (!isNotFound(error)) {
        this.logger.warn(
          { dependency: 'object-storage', error: errorName(error) },
          'Object storage bucket unavailable',
        );
        return false;
      }
    }
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.info({ dependency: 'object-storage' }, 'Object storage bucket created');
      return true;
    } catch (error) {
      this.logger.warn(
        { dependency: 'object-storage', error: errorName(error) },
        'Object storage bucket could not be created',
      );
      return false;
    }
  }

  async isAvailable(signal: AbortSignal): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }), {
        abortSignal: signal,
      });
      return true;
    } catch {
      return false;
    }
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  private objectKey(key: string): string {
    return `${this.folder}${key}`;
  }

  /** Logs the failure without the key's folder or any content (§13.5) and hides SDK errors. */
  private unavailable(operation: string, error: unknown): AppError {
    this.logger.warn(
      { dependency: 'object-storage', operation, error: errorName(error) },
      'Object storage request failed',
    );
    return new AppError('server.unavailable');
  }
}
