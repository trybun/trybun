import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_HTTP_STATUS, type ErrorCode } from '@trybun/contracts/errors';
import type { ProblemDetails } from '@trybun/contracts/problem-details';
import type { Request, Response } from 'express';
import { ACCESS_TOKEN_VERIFIER, type AccessTokenVerifier } from './access-token-verifier.js';
import { AuthenticationService } from './authentication.service.js';
import type { Principal } from './principal.js';
import { IS_PUBLIC } from './public.decorator.js';
import { isSecondFactorSatisfied } from './second-factor.js';

export type AuthenticatedRequest = Request & { principal: Principal };

/**
 * A bearer JWT: three base64url segments. API tokens (`trybun_pat_…`, `trybun_int_…`, §12.2)
 * contain no dots, so they never reach the JWT verification (§14.4).
 */
const BEARER_JWT = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/i;

/**
 * Step 1 of the request pipeline (§18.3): resolves the principal from the access token in the
 * `Authorization` header, otherwise `401`. API tokens join with their task (§12.2) and are
 * refused until then.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ACCESS_TOKEN_VERIFIER) private readonly verifier: AccessTokenVerifier,
    private readonly authentication: AuthenticationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const token = BEARER_JWT.exec(request.headers.authorization ?? '')?.[1];
    const claims = token === undefined ? undefined : await this.verifier.verify(token);
    const principal =
      claims === undefined ? undefined : await this.authentication.findPrincipal(claims.sub);
    if (claims === undefined || principal === undefined) {
      throw unauthorized(http.getResponse<Response>(), 'authentication.required');
    }
    if (!isSecondFactorSatisfied(principal.userKind, claims.amr)) {
      throw unauthorized(http.getResponse<Response>(), 'authentication.second_factor_required');
    }
    request.principal = principal;
    return true;
  }
}

/** `401` with Problem Details and the `WWW-Authenticate` challenge (RFC 6750, RFC 9470). */
function unauthorized(response: Response, code: ErrorCode): UnauthorizedException {
  response.setHeader(
    'WWW-Authenticate',
    code === 'authentication.second_factor_required'
      ? 'Bearer error="insufficient_user_authentication"'
      : 'Bearer',
  );
  const problem: ProblemDetails = {
    type: 'about:blank',
    title: 'Unauthorized',
    status: ERROR_HTTP_STATUS[code],
    code,
  };
  return new UnauthorizedException(problem);
}
