import { AppError } from '../../platform/errors/app-error.js';
import type { SetupService } from './setup.service.js';

/** Where a command writes: the standard output and error streams of the process. */
export interface CommandOutput {
  out(text: string): void;
  error(text: string): void;
}

/**
 * The exit code once an Administrator exists: `./trybun install` treats it as a completed
 * installation, `./trybun setup-token` passes it on.
 */
export const ALREADY_SET_UP_EXIT_CODE = 3;

/**
 * `setup-token` (§15.6), run by `./trybun setup-token` in the `api` container: prints a new setup
 * link, or refuses once an Administrator exists. Returns the exit code.
 */
export async function runSetupTokenCommand(
  setup: SetupService,
  domain: string,
  output: CommandOutput,
): Promise<number> {
  try {
    const { link, expiresAt } = await setup.issueToken();
    output.out(
      [
        'Open the first-run wizard to create the first Administrator:',
        '',
        `  ${link}`,
        '',
        `The link works once and expires at ${expiresAt.toISOString()}. Earlier links no longer work.`,
        '',
      ].join('\n'),
    );
    return 0;
  } catch (error) {
    if (error instanceof AppError && error.code === 'setup.completed') {
      output.error(
        `Trybun is already set up: an Administrator exists. Sign in at https://${domain}.\n`,
      );
      return ALREADY_SET_UP_EXIT_CODE;
    }
    throw error;
  }
}
