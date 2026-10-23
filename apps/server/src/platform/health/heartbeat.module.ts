import { Module } from '@nestjs/common';
import { HeartbeatService } from './heartbeat.service.js';

/** Heartbeat of the Worker process (§17.2). */
@Module({ providers: [HeartbeatService] })
export class HeartbeatModule {}
