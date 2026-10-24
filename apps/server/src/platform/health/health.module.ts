import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { ValkeyProbe } from './valkey-probe.js';

/** Health endpoints of the API process (§17.2). */
@Module({ controllers: [HealthController], providers: [HealthService, ValkeyProbe] })
export class HealthModule {}
