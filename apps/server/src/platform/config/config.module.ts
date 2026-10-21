import { type DynamicModule, Global, Module } from '@nestjs/common';
import type { TrybunConfig } from './config.schema.js';
import { loadConfig } from './load-config.js';

export const TRYBUN_CONFIG = 'TRYBUN_CONFIG';

/**
 * The typed configuration (§18.3). The entry points read it with `readConfig()` before the
 * application starts, so an invalid environment stops the process with one clear message.
 */
@Global()
@Module({})
export class ConfigModule {
  static forRoot(config: TrybunConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: TRYBUN_CONFIG, useValue: config }],
      exports: [TRYBUN_CONFIG],
    };
  }
}

/** The only reader of `process.env` (§18.3). */
export function readConfig(): TrybunConfig {
  return loadConfig(process.env);
}
