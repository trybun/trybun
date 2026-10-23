import 'server-only';
import { z } from 'zod';

/** The realm of Trybun in Keycloak (docker/keycloak/realm/trybun.yaml). */
const KEYCLOAK_REALM = 'trybun';

/** Server-side environment of the web application (§15.3); `NEXT_PUBLIC_*` is never used. */
const envSchema = z
  .object({
    TRYBUN_DOMAIN: z.hostname(),
    TRYBUN_API_URL: z.url({ protocol: /^https?$/ }),
    // Name defined by Prisma (§15.3); the database of the sessions (§14.4).
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    // Names defined by Auth.js 4 (§15.3): the public URL of the web application and the secret
    // that protects its cookies and encrypts the Keycloak tokens of the sessions.
    NEXTAUTH_URL: z.url({ protocol: /^https?$/ }),
    AUTH_SECRET: z.string().min(32),
    // Keycloak on the internal network: discovery, token endpoint, signing keys (§14.4).
    TRYBUN_KEYCLOAK_URL: z.url({ protocol: /^https?$/ }),
    // Public URL of Keycloak, the base of the token issuer. Default: https://<domain>/auth (§15.5).
    TRYBUN_KEYCLOAK_PUBLIC_URL: z.url({ protocol: /^https?$/ }).optional(),
    TRYBUN_KEYCLOAK_WEB_CLIENT_SECRET: z.string().min(1),
  })
  .transform((env) => ({
    domain: env.TRYBUN_DOMAIN,
    apiUrl: env.TRYBUN_API_URL,
    databaseUrl: env.DATABASE_URL,
    authSecret: env.AUTH_SECRET,
    keycloak: {
      issuer: `${env.TRYBUN_KEYCLOAK_PUBLIC_URL ?? `https://${env.TRYBUN_DOMAIN}/auth`}/realms/${KEYCLOAK_REALM}`,
      internalRealmUrl: `${env.TRYBUN_KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
      clientId: 'trybun-web',
      clientSecret: env.TRYBUN_KEYCLOAK_WEB_CLIENT_SECRET,
    },
  }));

export type WebEnv = z.output<typeof envSchema>;

export class InvalidEnvError extends Error {
  override readonly name = 'InvalidEnvError';
}

/** Parses the environment; an invalid or missing variable stops the start-up with a clear message. */
export function parseEnv(env: Record<string, string | undefined>): WebEnv {
  const result = envSchema.safeParse(env);
  if (result.success) {
    return result.data;
  }
  const problems = result.error.issues.map(
    (issue) => `  ${issue.path.join('.')}: ${issue.message}`,
  );
  throw new InvalidEnvError(
    ['Invalid configuration. Fix these environment variables:', ...problems].join('\n'),
  );
}

let cachedEnv: WebEnv | undefined;

/** The validated environment, parsed once per process. */
export function getEnv(): WebEnv {
  cachedEnv ??= parseEnv(process.env);
  return cachedEnv;
}
