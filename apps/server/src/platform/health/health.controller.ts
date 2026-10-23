import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { z } from 'zod';
import { ResponseSchema } from '../http/response-schema.decorator.js';

const healthSchema = z.object({ status: z.literal('ok') });

/**
 * Liveness of the API for the Compose health check (§15.9, §17.2): it checks no dependency, so
 * an outage of one never restarts the API. Reachable only on the internal network (§14.4).
 */
@ApiExcludeController()
@Controller('health')
export class HealthController {
  @Get()
  @ResponseSchema(healthSchema)
  check(): z.infer<typeof healthSchema> {
    return { status: 'ok' };
  }
}
