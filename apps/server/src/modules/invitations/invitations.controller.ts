import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiResponse } from '@nestjs/swagger';
import {
  type AcceptedInvitation,
  acceptedInvitationSchema,
  type AcceptInvitationDto,
  acceptInvitationSchema,
  type CreatedInvitation,
  createdInvitationSchema,
  type CreateInvitationInput,
  createInvitationSchema,
  type InvitationPage,
  invitationPageSchema,
  type InvitationParams,
  invitationParamsSchema,
  type InvitationPreview,
  invitationPreviewSchema,
  type InvitationToAccept,
  invitationToAcceptSchema,
  type ListInvitationsQuery,
  listInvitationsQuerySchema,
  type ResentInvitation,
  resentInvitationSchema,
  type VerifyInvitationTokenDto,
  verifyInvitationTokenSchema,
} from '@trybun/contracts/invitations';
import type { Response } from 'express';
import { AccessToken } from '../../platform/authentication/access-token.decorator.js';
import { CurrentPrincipal } from '../../platform/authentication/current-principal.decorator.js';
import type { Principal } from '../../platform/authentication/principal.js';
import { Public } from '../../platform/authentication/public.decorator.js';
import { TargetRecord } from '../../platform/authorization/target-record.decorator.js';
import { ClientIp } from '../../platform/http/client-ip.decorator.js';
import { ResponseSchema } from '../../platform/http/response-schema.decorator.js';
import { InvitationAcceptanceService } from './invitation-acceptance.service.js';
import { INVITATION } from './invitations.abilities.js';
import { InvitationsService } from './invitations.service.js';

@Controller()
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly acceptance: InvitationAcceptanceService,
  ) {}

  /** What issuing would do – invite or grant directly – before sending (§7.4). Writes nothing. */
  @Post('invitation-previews')
  @HttpCode(HttpStatus.OK)
  @ResponseSchema(invitationPreviewSchema)
  preview(
    @CurrentPrincipal() principal: Principal,
    @Body({ schema: createInvitationSchema }) input: CreateInvitationInput,
  ): Promise<InvitationPreview> {
    return this.invitations.preview(principal, input);
  }

  /**
   * Issues an invitation with its link (`201`), or grants the access directly to an active
   * account (`200`, §7.4).
   */
  @Post('invitations')
  @ResponseSchema(createdInvitationSchema, HttpStatus.CREATED)
  @ApiResponse({
    status: HttpStatus.OK,
    standardSchema: createdInvitationSchema,
    description: 'The address has an active account: the access was granted directly.',
  })
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body({ schema: createInvitationSchema }) input: CreateInvitationInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CreatedInvitation> {
    const { created, isNew } = await this.invitations.create(principal, input);
    if (!isNew) {
      response.status(HttpStatus.OK);
    }
    return created;
  }

  /** The invitations of a project, an organization or an account; pending ones by default. */
  @Get('invitations')
  @ResponseSchema(invitationPageSchema)
  list(
    @CurrentPrincipal() principal: Principal,
    @Query({ schema: listInvitationsQuerySchema }) query: ListInvitationsQuery,
  ): Promise<InvitationPage> {
    return this.invitations.list(principal, query);
  }

  /** A new link for a pending or expired invitation; the old link stops working (§7.4). */
  @Post('invitations/:invitationId/resending')
  @TargetRecord({ subject: INVITATION, param: 'invitationId', action: 'resend' })
  @HttpCode(HttpStatus.OK)
  @ResponseSchema(resentInvitationSchema)
  resend(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: invitationParamsSchema }) { invitationId }: InvitationParams,
  ): Promise<ResentInvitation> {
    return this.invitations.resend(principal, invitationId);
  }

  /** Revokes a pending invitation (§7.4). */
  @Post('invitations/:invitationId/revocation')
  @TargetRecord({ subject: INVITATION, param: 'invitationId', action: 'revoke' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  revoke(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: invitationParamsSchema }) { invitationId }: InvitationParams,
  ): Promise<void> {
    return this.invitations.revoke(principal, invitationId);
  }

  /**
   * Checks the token of an invitation link before the acceptance page is shown (ADR 0009). Needs
   * no session; like every public endpoint it is rate-limited by client IP (§14.4).
   */
  @Post('invitations/token-verification')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseSchema(invitationToAcceptSchema)
  verifyToken(
    @Body({ schema: verifyInvitationTokenSchema }) input: VerifyInvitationTokenDto,
  ): Promise<InvitationToAccept> {
    return this.acceptance.verifyToken(input);
  }

  /**
   * Accepts an invitation (ADR 0009): with a password, without a session, or with the access token
   * of a sign-in through an identity provider, whose Keycloak user may have no account yet – so
   * the endpoint is public and verifies the token itself. Rate-limited by client IP (§14.4).
   */
  @Post('invitations/acceptance')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseSchema(acceptedInvitationSchema)
  accept(
    @Body({ schema: acceptInvitationSchema }) input: AcceptInvitationDto,
    @AccessToken() accessToken: string | undefined,
    @ClientIp() clientIp: string | undefined,
  ): Promise<AcceptedInvitation> {
    return this.acceptance.accept(input, accessToken, clientIp);
  }
}
