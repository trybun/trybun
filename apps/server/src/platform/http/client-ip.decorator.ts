import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * The client IP of the request, from the `X-Forwarded-For` of the trusted proxies (§14.4), for the
 * security events of the audit log (§13.5).
 */
export const ClientIp = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    context.switchToHttp().getRequest<Request>().ip,
);
