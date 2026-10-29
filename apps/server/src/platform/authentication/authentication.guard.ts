import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError } from '../errors/app-error.js';
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

/** The JWT of the `Authorization` header; `undefined` without one. */
export function bearerJwt(request: Pick<Request, 'headers'>): string | undefined {
  return BEARER_JWT.exec(request.headers.authorization ?? '')?.[1];
}

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
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerJwt(request);
    // Every request goes through the verification; without a JWT it fails as an invalid token.
    const claims = await this.verifier.verify(token ?? '');
    const principal =
      claims === undefined ? undefined : await this.authentication.findPrincipal(claims.sub);
    if (claims === undefined || principal === undefined) {
      throw new AppError('authentication.required');
    }
    if (!isSecondFactorSatisfied(principal.userKind, claims.amr)) {
      throw new AppError('authentication.second_factor_required');
    }
    request.principal = principal;
    return true;
  }
}
