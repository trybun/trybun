import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

/** Health endpoint of the API process (§17.2). */
@Module({ controllers: [HealthController] })
export class HealthModule {}
