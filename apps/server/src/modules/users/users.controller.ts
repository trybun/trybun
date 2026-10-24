import { Body, Controller, Get, Param, Put } from '@nestjs/common';
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
import { type CurrentUser, currentUserSchema } from '@trybun/contracts/users';
import { CurrentPrincipal } from '../../platform/authentication/current-principal.decorator.js';
import type { Principal } from '../../platform/authentication/principal.js';
import { ResponseSchema } from '../../platform/http/response-schema.decorator.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** The signed-in account, shown by the application shell (§18.5). */
  @Get('me')
  @ResponseSchema(currentUserSchema)
  findCurrent(@CurrentPrincipal() principal: Principal): Promise<CurrentUser> {
    return this.users.findCurrent(principal);
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
}
