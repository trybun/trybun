import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

/** Environment variables of the API and the Worker (§15.3), validated at start-up. */
export const configSchema = z
  .object({
    TRYBUN_DOMAIN: z.hostname(),
    TRYBUN_API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    // Name defined by Prisma (§15.3).
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    TRYBUN_VALKEY_URL: z.url({ protocol: /^rediss?$/ }),
    TRYBUN_WORKER_HEARTBEAT_FILE: z
      .string()
      .min(1)
      .default(join(tmpdir(), 'trybun-worker.heartbeat')),
  })
  .transform((env) => ({
    domain: env.TRYBUN_DOMAIN,
    apiPort: env.TRYBUN_API_PORT,
    databaseUrl: env.DATABASE_URL,
    valkeyUrl: env.TRYBUN_VALKEY_URL,
    workerHeartbeatFile: env.TRYBUN_WORKER_HEARTBEAT_FILE,
  }));

export type TrybunConfig = z.output<typeof configSchema>;
