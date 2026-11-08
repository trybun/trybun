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

/** A bucket name of S3: 3–63 lower-case letters, digits, dots and hyphens. */
const BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

const STORAGE_URL_PATTERN =
  /^[Hh][Tt][Tt][Pp][Ss]?:\/\/(?:\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9._-]+)(?::[0-9]{1,5})?\/[a-z0-9][a-z0-9.-]{1,61}[a-z0-9](?:\/[A-Za-z0-9._~%+,:@=!-]*)*$/;

/** Whether the path of a URL, as written, has a `.` or `..` segment, also percent-encoded. */
function hasDotSegment(url: string): boolean {
  const path = url.replace(/^[^:]+:\/\/[^/]*/, '').replace(/%2e/gi, '.');
  return path.split('/').some((segment) => segment === '.' || segment === '..');
}

/** The segments of a URL path, without empty ones (`/trybun/files/` → `trybun`, `files`). */
function pathSegments(url: string): string[] {
  return new URL(url).pathname.split('/').filter((segment) => segment !== '');
}

/**
 * The bucket URL of the object storage with an optional folder, in the form of
 * `TRYBUN_BACKUP_S3_URL` (§15.3): the first path segment is the bucket, the rest the folder.
 */
const storageUrlSchema = z
  .url({ protocol: /^https?$/ })
  // The characters the backup service and `./trybun restore` accept, so a URL the API runs with
  // is never refused by them (§15.3): a host name or IP, a bucket, folder segments without dot
  // segments.
  .refine(
    (url) => STORAGE_URL_PATTERN.test(url) && !hasDotSegment(url),
    'Must be http(s)://host[:port]/bucket[/folder] without dot segments or other characters',
  )
  .refine((url) => BUCKET_NAME.test(pathSegments(url)[0] ?? ''), 'Must name a bucket in the path')
  .refine((url) => {
    const { username, password, search, hash } = new URL(url);
    return username === '' && password === '' && search === '' && hash === '';
  }, 'Must have no credentials, query or fragment');

/** clamd over TCP (ADR 0008), e.g. `tcp://clamav:3310`. */
const clamavUrlSchema = z
  .url({ protocol: /^tcp$/ })
  .refine((url) => new URL(url).port !== '', 'Must have a port');

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
    // The object storage of the attachments (§15.3, ADR 0008): SeaweedFS of Compose by default.
    TRYBUN_S3_URL: storageUrlSchema.default('http://localhost:8333/trybun'),
    TRYBUN_S3_ACCESS_KEY_ID: z.string().min(1),
    TRYBUN_S3_SECRET_ACCESS_KEY: z.string().min(1),
    TRYBUN_S3_REGION: z.string().min(1).default('us-east-1'),
    // The malware scanner (§13.3, ADR 0008).
    TRYBUN_CLAMAV_URL: clamavUrlSchema.default('tcp://localhost:3310'),
    // The maximum size of one attachment, set by the Administrator (§13.3); at most clamd's
    // StreamMaxLength (docker/clamav/clamd.conf).
    TRYBUN_ATTACHMENT_MAX_SIZE_MB: z.coerce.number().int().min(1).max(100).default(25),
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
    storage: {
      endpoint: new URL(env.TRYBUN_S3_URL).origin,
      bucket: pathSegments(env.TRYBUN_S3_URL)[0] ?? '',
      folder: pathSegments(env.TRYBUN_S3_URL).slice(1).join('/'),
      region: env.TRYBUN_S3_REGION,
      accessKeyId: env.TRYBUN_S3_ACCESS_KEY_ID,
      secretAccessKey: env.TRYBUN_S3_SECRET_ACCESS_KEY,
    },
    clamav: {
      host: new URL(env.TRYBUN_CLAMAV_URL).hostname,
      port: Number(new URL(env.TRYBUN_CLAMAV_URL).port),
    },
    attachmentMaxSizeBytes: env.TRYBUN_ATTACHMENT_MAX_SIZE_MB * 1024 * 1024,
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
