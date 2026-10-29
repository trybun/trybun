import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import {
  type ProductTourParams,
  type ProductTourProgress,
  type ProductTourProgressPage,
  productTourParamsSchema,
  productTourProgressPageSchema,
  productTourProgressSchema,
  type RecordProductTourProgressDto,
  recordProductTourProgressSchema,
} from '@trybun/contracts/product-tours';
import {
  type CurrentUser,
  currentUserSchema,
  type ListUsersQuery,
  listUsersQuerySchema,
  type UpdateCurrentUserDto,
  updateCurrentUserSchema,
  type UserPage,
  userPageSchema,
  type UserParams,
  userParamsSchema,
} from '@trybun/contracts/users';
import { CurrentPrincipal } from '../../platform/authentication/current-principal.decorator.js';
import type { Principal } from '../../platform/authentication/principal.js';
import { TargetRecord } from '../../platform/authorization/target-record.decorator.js';
import { ResponseSchema } from '../../platform/http/response-schema.decorator.js';
import { USER } from './users.abilities.js';
import { UsersService } from './users.service.js';

/**
 * The changes of an account check their action in the service, after the rule of the last active
 * Administrator (§7.4); the target record guard checks only that the account is visible.
 */
const VISIBLE_ACCOUNT = { subject: USER, param: 'userId', action: 'read' } as const;

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** The accounts of the Accounts page (§7.4); the Administrator only. */
  @Get()
  @ResponseSchema(userPageSchema)
  list(
    @CurrentPrincipal() principal: Principal,
    @Query({ schema: listUsersQuerySchema }) query: ListUsersQuery,
  ): Promise<UserPage> {
    return this.users.list(principal, query);
  }

  /** The signed-in account, shown by the application shell (§18.5). */
  @Get('me')
  @ResponseSchema(currentUserSchema)
  findCurrent(@CurrentPrincipal() principal: Principal): Promise<CurrentUser> {
    return this.users.findCurrent(principal);
  }

  /** Changes the language and the time zone of the signed-in account (§13.1). */
  @Patch('me')
  @ResponseSchema(currentUserSchema)
  updateCurrent(
    @CurrentPrincipal() principal: Principal,
    @Body({ schema: updateCurrentUserSchema }) input: UpdateCurrentUserDto,
  ): Promise<CurrentUser> {
    return this.users.updateCurrent(principal, input);
  }

  /** The product tours the signed-in person completed or skipped (§2.4). */
  @Get('me/product-tours')
  @ResponseSchema(productTourProgressPageSchema)
  findProductTourProgress(
    @CurrentPrincipal() principal: Principal,
  ): Promise<ProductTourProgressPage> {
    return this.users.findProductTourProgress(principal);
  }

  /** Records how the signed-in person ended a product tour (§2.4). */
  @Put('me/product-tours/:tourId')
  @ResponseSchema(productTourProgressSchema)
  recordProductTourProgress(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: productTourParamsSchema }) { tourId }: ProductTourParams,
    @Body({ schema: recordProductTourProgressSchema }) input: RecordProductTourProgressDto,
  ): Promise<ProductTourProgress> {
    return this.users.recordProductTourProgress(principal, tourId, input);
  }

  /** Deactivates an account and ends all its sessions (§7.4). */
  @Post(':userId/deactivation')
  @TargetRecord(VISIBLE_ACCOUNT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deactivate(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: userParamsSchema }) { userId }: UserParams,
  ): Promise<void> {
    return this.users.deactivate(principal, userId);
  }

  /** Reactivates a deactivated account (§7.4). */
  @Post(':userId/reactivation')
  @TargetRecord(VISIBLE_ACCOUNT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  reactivate(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: userParamsSchema }) { userId }: UserParams,
  ): Promise<void> {
    return this.users.reactivate(principal, userId);
  }

  /** Grants the Administrator role to a team account (§7.5); idempotent. */
  @Put(':userId/administrator-role')
  @TargetRecord(VISIBLE_ACCOUNT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  grantAdministratorRole(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: userParamsSchema }) { userId }: UserParams,
  ): Promise<void> {
    return this.users.grantAdministratorRole(principal, userId);
  }

  /** Revokes the Administrator role (§7.5); idempotent. */
  @Delete(':userId/administrator-role')
  @TargetRecord(VISIBLE_ACCOUNT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  revokeAdministratorRole(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: userParamsSchema }) { userId }: UserParams,
  ): Promise<void> {
    return this.users.revokeAdministratorRole(principal, userId);
  }
}
