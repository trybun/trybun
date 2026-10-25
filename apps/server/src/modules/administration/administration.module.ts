import { Module } from '@nestjs/common';
import { AdministrationController } from './administration.controller.js';
import { AdministrationService } from './administration.service.js';

/** The Administrator panel (§15.6): the getting-started checklist and the "About" page. */
@Module({
  controllers: [AdministrationController],
  providers: [AdministrationService],
})
export class AdministrationModule {}
