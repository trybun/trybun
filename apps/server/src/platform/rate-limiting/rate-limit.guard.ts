import { createHash } from 'node:crypto';
import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerRequest } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../authentication/authentication.guard.js';
import { AppError } from '../errors/app-error.js';
import { rateLimitHeaders } from './rate-limits.js';

/**
 * Rate limiting of the API (§14.4) with `@nestjs/throttler`, after the authentication guard: one
 * counter per user for all endpoints, and one per client IP for the public endpoints. The response
 * carries the `RateLimit` headers; a request over the limit returns `429` with `Retry-After`.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  /** The user ID, else the client IP (`X-Forwarded-For` of the internal network, §14.4). */
  protected override async getTracker(req: Partial<AuthenticatedRequest>): Promise<string> {
    return req.principal?.userId ?? super.getTracker(req);
  }

  /** One counter per tracker across the endpoints; Valkey keeps neither user IDs nor IPs. */
  protected override generateKey(
    _context: ExecutionContext,
    tracker: string,
    name: string,
  ): string {
    return createHash('sha256').update(`${name}-${tracker}`).digest('base64url');
  }

  protected override async handleRequest({
    context,
    limit,
    ttl,
    blockDuration,
    throttler,
    getTracker,
    generateKey,
  }: ThrottlerRequest): Promise<boolean> {
    const { req, res } = this.getRequestResponse(context);
    const name = throttler.name ?? 'default';
    const key = generateKey(context, await getTracker(req, context), name);
    const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
      await this.storageService.increment(key, ttl, limit, blockDuration, name);
    const response = res as Response;
    response.set(
      rateLimitHeaders({
        policy: name,
        limit,
        window: Math.ceil(ttl / 1_000),
        remaining: Math.max(0, limit - totalHits),
        reset: isBlocked ? timeToBlockExpire : timeToExpire,
      }),
    );
    if (isBlocked) {
      response.set('Retry-After', String(timeToBlockExpire));
      throw new AppError('request.rate_limited');
    }
    return true;
  }
}
