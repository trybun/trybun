import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { CliModule } from './cli.module.js';
import { SetupService } from './modules/setup/setup.service.js';
import { type CommandOutput, runSetupTokenCommand } from './modules/setup/setup-token.command.js';
import { readConfig } from './platform/config/config.module.js';

// The command line of the `server` image (§14.6): `node dist/cli.js <command>`, run by the
// `trybun` script of the deployment package in the `api` container (§15.5).
const USAGE = 'Usage: node dist/cli.js setup-token\n';

const output: CommandOutput = {
  out: (text) => process.stdout.write(text),
  error: (text) => process.stderr.write(text),
};

async function run(command: string | undefined): Promise<number> {
  if (command !== 'setup-token') {
    output.error(USAGE);
    return 2;
  }
  const config = readConfig();
  // Human-readable output only: the logs of NestJS itself are off.
  const app = await NestFactory.createApplicationContext(CliModule.forRoot(config), {
    abortOnError: false,
    logger: false,
  });
  try {
    return await runSetupTokenCommand(app.get(SetupService), config.domain, output);
  } finally {
    await app.close();
  }
}

run(process.argv[2]).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    // An invalid configuration names variables, never personal data.
    output.error(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
