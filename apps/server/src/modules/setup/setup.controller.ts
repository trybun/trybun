import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  type CreateAdministratorDto,
  type CreatedAdministrator,
  createAdministratorSchema,
  createdAdministratorSchema,
  type Setup,
  setupSchema,
  type VerifySetupTokenDto,
  verifySetupTokenSchema,
} from '@trybun/contracts/setup';
import { Public } from '../../platform/authentication/public.decorator.js';
import { ResponseSchema } from '../../platform/http/response-schema.decorator.js';
import { SetupService } from './setup.service.js';

/**
 * The first-run wizard (§15.6). It needs no session: the setup token protects it until the first
 * Administrator exists, and then it is disabled permanently. Rate limiting by client IP comes with
 * S0-14 (§14.4).
 */
@Public()
@Controller('setup')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  /** Whether the wizard is available, e.g. for the note of the sign-in page. */
  @Get()
  @ResponseSchema(setupSchema)
  find(): Promise<Setup> {
    return this.setup.findSetup();
  }

  /** Checks the token of the setup link before the form is shown. */
  @Post('token-verification')
  @HttpCode(HttpStatus.OK)
  @ResponseSchema(setupSchema)
  verifyToken(
    @Body({ schema: verifySetupTokenSchema }) input: VerifySetupTokenDto,
  ): Promise<Setup> {
    return this.setup.verifyToken(input);
  }

  /** Creates the first Administrator with the setup token. */
  @Post('administrator')
  @ResponseSchema(createdAdministratorSchema)
  createAdministrator(
    @Body({ schema: createAdministratorSchema }) input: CreateAdministratorDto,
  ): Promise<CreatedAdministrator> {
    return this.setup.createAdministrator(input);
  }
}
