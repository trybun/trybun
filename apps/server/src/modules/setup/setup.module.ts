import { Module } from '@nestjs/common';
import { SetupController } from './setup.controller.js';
import { SetupService } from './setup.service.js';

/** The first-run wizard and the setup token (§15.6). */
@Module({
  controllers: [SetupController],
  providers: [SetupService],
  exports: [SetupService],
})
export class SetupModule {}
