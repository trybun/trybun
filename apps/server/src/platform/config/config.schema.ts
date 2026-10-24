import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LOCALES } from '@trybun/i18n/catalogues';
import { isTimeZone } from '@trybun/i18n/time-zones';
import { z } from 'zod';

/** The realm of Trybun in Keycloak (docker/keycloak/realm/trybun.yaml). */
const KEYCLOAK_REALM = 'trybun';

/** Environment variables of the API and the Worker (§15.3), validated at start-up. */
export const configSchema = z
  .object({
    TRYBUN_DOMAIN: z.hostname(),
    TRYBUN_API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    // Name defined by Prisma (§15.3).
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    TRYBUN_VALKEY_URL: z.url({ protocol: /^rediss?$/ }),
    // Keycloak on the internal network, for its signing keys (§14.4).
    TRYBUN_KEYCLOAK_URL: z.url({ protocol: /^https?$/ }),
    // Public URL of Keycloak, the base of the token issuer. Default: https://<domain>/auth (§15.5).
    TRYBUN_KEYCLOAK_PUBLIC_URL: z.url({ protocol: /^https?$/ }).optional(),
    // The system default language and time zone (§13.1), set by the install script (§15.5).
    TRYBUN_DEFAULT_LANGUAGE: z.enum(LOCALES).default('en'),
    TRYBUN_DEFAULT_TIME_ZONE: z
      .string()
      .refine(isTimeZone, 'Invalid IANA time zone')
      .default('UTC'),
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
    keycloak: {
      issuer: `${env.TRYBUN_KEYCLOAK_PUBLIC_URL ?? `https://${env.TRYBUN_DOMAIN}/auth`}/realms/${KEYCLOAK_REALM}`,
      jwksUrl: `${env.TRYBUN_KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`,
    },
    defaultLanguage: env.TRYBUN_DEFAULT_LANGUAGE,
    defaultTimeZone: env.TRYBUN_DEFAULT_TIME_ZONE,
    workerHeartbeatFile: env.TRYBUN_WORKER_HEARTBEAT_FILE,
  }));

export type TrybunConfig = z.output<typeof configSchema>;
