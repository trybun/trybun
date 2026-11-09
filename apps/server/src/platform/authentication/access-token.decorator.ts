import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { bearerJwt } from './authentication.guard.js';

/**
 * The access token of the `Authorization` header of a public endpoint, unverified; `undefined`
 * without one. Only the acceptance of an invitation reads it, to bind the Keycloak user of a
 * sign-in that has no account yet (ADR 0009); the service verifies it.
 */
export const AccessToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    bearerJwt(context.switchToHttp().getRequest<Request>()),
);
