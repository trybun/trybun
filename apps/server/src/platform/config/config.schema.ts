import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LOCALES } from '@trybun/i18n/catalogues';
import { isTimeZone } from '@trybun/i18n/time-zones';
import { z } from 'zod';

/** The realm of Trybun in Keycloak (docker/keycloak/realm/trybun.yaml). */
const KEYCLOAK_REALM = 'trybun';

function isSet(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== '';
}

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
    // Secret of the Keycloak client `trybun-server`, the service account of the Admin API (§15.5).
    TRYBUN_KEYCLOAK_SERVER_CLIENT_SECRET: z.string().min(1),
    // Settings the getting-started checklist reads (§15.6); an empty value counts as not set.
    TRYBUN_GITHUB_CLIENT_ID: z.string().optional(),
    TRYBUN_GITHUB_CLIENT_SECRET: z.string().optional(),
    TRYBUN_SMTP_HOST: z.string().optional(),
    TRYBUN_MAIL_FROM: z.string().optional(),
    // The external S3 storage of the backups (§15.10).
    TRYBUN_BACKUP_S3_URL: z.string().optional(),
    // The system default language and time zone (§13.1), set by the install script (§15.5).
    TRYBUN_DEFAULT_LANGUAGE: z.enum(LOCALES).default('en'),
    TRYBUN_DEFAULT_TIME_ZONE: z
      .string()
      .refine(isTimeZone, 'Invalid IANA time zone')
      .default('UTC'),
    // Requests per minute of the API rate limits (§14.4).
    TRYBUN_RATE_LIMIT_PER_USER: z.coerce.number().int().min(1).default(100),
    TRYBUN_RATE_LIMIT_PER_IP: z.coerce.number().int().min(1).default(20),
    TRYBUN_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
    TRYBUN_WORKER_HEARTBEAT_FILE: z
      .string()
      .min(1)
      .default(join(tmpdir(), 'trybun-worker.heartbeat')),
  })
  .refine((env) => !isSet(env.TRYBUN_SMTP_HOST) || isSet(env.TRYBUN_MAIL_FROM), {
    message: 'Required with TRYBUN_SMTP_HOST',
    path: ['TRYBUN_MAIL_FROM'],
  })
  .transform((env) => ({
    domain: env.TRYBUN_DOMAIN,
    apiPort: env.TRYBUN_API_PORT,
    databaseUrl: env.DATABASE_URL,
    valkeyUrl: env.TRYBUN_VALKEY_URL,
    keycloak: {
      issuer: `${env.TRYBUN_KEYCLOAK_PUBLIC_URL ?? `https://${env.TRYBUN_DOMAIN}/auth`}/realms/${KEYCLOAK_REALM}`,
      jwksUrl: `${env.TRYBUN_KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`,
      tokenUrl: `${env.TRYBUN_KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
      adminUrl: `${env.TRYBUN_KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}`,
      serverClientSecret: env.TRYBUN_KEYCLOAK_SERVER_CLIENT_SECRET,
    },
    isGithubSignInConfigured:
      isSet(env.TRYBUN_GITHUB_CLIENT_ID) && isSet(env.TRYBUN_GITHUB_CLIENT_SECRET),
    isSmtpConfigured: isSet(env.TRYBUN_SMTP_HOST),
    isBackupStorageConfigured: isSet(env.TRYBUN_BACKUP_S3_URL),
    defaultLanguage: env.TRYBUN_DEFAULT_LANGUAGE,
    defaultTimeZone: env.TRYBUN_DEFAULT_TIME_ZONE,
    rateLimits: { user: env.TRYBUN_RATE_LIMIT_PER_USER, ip: env.TRYBUN_RATE_LIMIT_PER_IP },
    logLevel: env.TRYBUN_LOG_LEVEL,
    workerHeartbeatFile: env.TRYBUN_WORKER_HEARTBEAT_FILE,
  }));

export type TrybunConfig = z.output<typeof configSchema>;
