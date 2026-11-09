import { Global, Module } from '@nestjs/common';
import { OBJECT_STORAGE } from './object-storage.js';
import { S3ObjectStorage } from './s3-object-storage.js';

/** The adapter of the object storage (§18.3) for the Worker; the API creates the bucket. */
@Global()
@Module({
  providers: [{ provide: OBJECT_STORAGE, useClass: S3ObjectStorage }],
  exports: [OBJECT_STORAGE],
})
export class StorageWorkerModule {}
