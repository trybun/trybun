import { Controller, Get } from '@nestjs/common';
import {
  type About,
  aboutSchema,
  type GettingStartedPage,
  gettingStartedPageSchema,
} from '@trybun/contracts/administration';
import { CurrentPrincipal } from '../../platform/authentication/current-principal.decorator.js';
import type { Principal } from '../../platform/authentication/principal.js';
import { ResponseSchema } from '../../platform/http/response-schema.decorator.js';
import { AdministrationService } from './administration.service.js';

@Controller('administration')
export class AdministrationController {
  constructor(private readonly administration: AdministrationService) {}

  /** The getting-started checklist of the Administrator panel (§15.6). */
  @Get('getting-started')
  @ResponseSchema(gettingStartedPageSchema)
  findGettingStarted(@CurrentPrincipal() principal: Principal): GettingStartedPage {
    return this.administration.findGettingStarted(principal);
  }

  /** The installed version and the license (§15.4). */
  @Get('about')
  @ResponseSchema(aboutSchema)
  findAbout(@CurrentPrincipal() principal: Principal): About {
    return this.administration.findAbout(principal);
  }
}
