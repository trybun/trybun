import { Global, Inject, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage.js';
import { S3ObjectStorage } from './s3-object-storage.js';

/**
 * The adapter of the object storage (§18.3) for the API, which creates a missing bucket at
 * start-up (§15.3); a refusal leaves the API running with the storage reported as `degraded`
 * (§17.2).
 */
@Global()
@Module({
  providers: [{ provide: OBJECT_STORAGE, useClass: S3ObjectStorage }],
  exports: [OBJECT_STORAGE],
})
export class StorageModule implements OnApplicationBootstrap {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.storage.ensureBucket();
  }
}
