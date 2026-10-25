import { SkipThrottle } from '@nestjs/throttler';
import { RATE_LIMIT_POLICIES } from './rate-limits.js';

/** Exempts a controller or handler from every rate limit, e.g. the health endpoints (§14.4). */
export const SkipRateLimit = (): ClassDecorator & MethodDecorator =>
  SkipThrottle(
    Object.fromEntries(Object.keys(RATE_LIMIT_POLICIES).map((policy) => [policy, true])),
  );
