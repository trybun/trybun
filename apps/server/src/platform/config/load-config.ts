import { configSchema, type TrybunConfig } from './config.schema.js';

export class InvalidConfigError extends Error {
  override readonly name = 'InvalidConfigError';
}

/** Parses the environment; an invalid or missing variable stops the start-up with a clear message. */
export function loadConfig(env: Record<string, string | undefined>): TrybunConfig {
  const result = configSchema.safeParse(env);
  if (result.success) {
    return result.data;
  }
  const problems = result.error.issues.map(
    (issue) => `  ${issue.path.join('.')}: ${issue.message}`,
  );
  throw new InvalidConfigError(
    ['Invalid configuration. Fix these environment variables:', ...problems].join('\n'),
  );
}
