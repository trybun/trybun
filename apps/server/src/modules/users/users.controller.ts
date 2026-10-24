import { Controller, Get } from '@nestjs/common';
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
}
