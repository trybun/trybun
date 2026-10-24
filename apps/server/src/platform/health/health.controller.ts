import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { z } from 'zod';
import packageJson from '../../../package.json' with { type: 'json' };
import { Public } from '../authentication/public.decorator.js';
import { ResponseSchema } from '../http/response-schema.decorator.js';
import { HealthService } from './health.service.js';

const healthSchema = z.object({ status: z.literal('ok'), version: z.string() });

const dependencyStatusSchema = z.enum(['ok', 'degraded']);

const readinessSchema = z.object({
  status: dependencyStatusSchema,
  database: z.literal('ok'),
  valkey: dependencyStatusSchema,
});

/**
 * Health endpoints of the API for the Compose health check and monitoring (§15.9, §17.2).
 * Reachable only on the internal network (§14.4).
 */
@ApiExcludeController()
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness: checks no dependency, so an outage of one never restarts the API. */
  @Get()
  @ResponseSchema(healthSchema)
  check(): z.infer<typeof healthSchema> {
    return { status: 'ok', version: packageJson.version };
  }

  /** Readiness: `503` only when PostgreSQL is unavailable. */
  @Get('ready')
  @ResponseSchema(readinessSchema)
  ready(): Promise<z.infer<typeof readinessSchema>> {
    return this.health.readiness();
  }
}
