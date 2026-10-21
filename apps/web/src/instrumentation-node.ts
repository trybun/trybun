import { getEnv, InvalidEnvError } from './lib/env/env.js';

/**
 * Validates the environment once when the server starts (§14.4). Next.js only logs errors of
 * the instrumentation hook and keeps serving, so an invalid configuration ends the process here.
 */
export function validateEnv(): void {
  try {
    getEnv();
  } catch (error) {
    if (!(error instanceof InvalidEnvError)) {
      throw error;
    }
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
