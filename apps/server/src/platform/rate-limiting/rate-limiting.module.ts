import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { RATE_LIMIT_THROTTLERS } from './rate-limits.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import { ValkeyThrottlerStorage } from './valkey-throttler-storage.js';

@Module({ providers: [ValkeyThrottlerStorage], exports: [ValkeyThrottlerStorage] })
class RateLimitStorageModule {}

/**
 * Rate limiting of the API (§14.4): a global guard, registered after the authentication guard so
 * that it knows the principal of the request, with its counters in Valkey.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [RateLimitStorageModule],
      inject: [ValkeyThrottlerStorage],
      useFactory: (storage: ValkeyThrottlerStorage) => ({
        throttlers: RATE_LIMIT_THROTTLERS,
        storage,
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class RateLimitingModule {}
