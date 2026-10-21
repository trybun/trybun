import 'server-only';
import { z } from 'zod';

/** Server-side environment of the web application (§15.3); `NEXT_PUBLIC_*` is never used. */
const envSchema = z
  .object({
    TRYBUN_DOMAIN: z.hostname(),
    TRYBUN_API_URL: z.url({ protocol: /^https?$/ }),
  })
  .transform((env) => ({
    domain: env.TRYBUN_DOMAIN,
    apiUrl: env.TRYBUN_API_URL,
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
