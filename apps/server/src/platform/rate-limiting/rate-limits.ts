import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerOptions } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../authentication/authentication.guard.js';
import type { Principal } from '../authentication/principal.js';
import type { TrybunConfig } from '../config/config.schema.js';

/** The window of every rate limit (§14.4): one minute, in milliseconds as the throttler counts. */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * The policies of the API (§14.4), named in the `RateLimit` headers: requests of a user, keyed by
 * the user ID, and requests without a principal – the public endpoints – keyed by the client IP.
 * The policy of integration tokens joins with API tokens (§12.2).
 */
export const RATE_LIMIT_POLICIES = ['user', 'ip'] as const;

/** The principal the authentication guard resolved, before the rate limit runs. */
export function principalOf(context: ExecutionContext): Principal | undefined {
  return context.switchToHttp().getRequest<Partial<AuthenticatedRequest>>().principal;
}

/** The throttlers of `@nestjs/throttler` with the configured limits: one applies to a request. */
export function rateLimitThrottlers(limits: TrybunConfig['rateLimits']): ThrottlerOptions[] {
  return [
    {
      name: 'user',
      ttl: RATE_LIMIT_WINDOW_MS,
      limit: limits.user,
      skipIf: (context) => principalOf(context) === undefined,
    },
    {
      name: 'ip',
      ttl: RATE_LIMIT_WINDOW_MS,
      limit: limits.ip,
      skipIf: (context) => principalOf(context) !== undefined,
    },
  ];
}

export interface RateLimitState {
  policy: string;
  limit: number;
  /** Seconds. */
  window: number;
  remaining: number;
  /** Seconds until the quota is restored. */
  reset: number;
}

/**
 * The response headers of a rate limit (§14.4, IETF draft "RateLimit header fields for HTTP"):
 * the quota of the policy and the remaining requests until the window is reset.
 */
export function rateLimitHeaders(state: RateLimitState): Record<string, string> {
  return {
    'RateLimit-Policy': `"${state.policy}";q=${state.limit};w=${state.window}`,
    RateLimit: `"${state.policy}";r=${state.remaining};t=${state.reset}`,
  };
}
