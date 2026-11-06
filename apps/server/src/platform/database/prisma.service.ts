import { createCaslExtension } from '@casl/prisma/runtime';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { type Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { TRYBUN_CONFIG } from '../config/config.module.js';
import type { TrybunConfig } from '../config/config.schema.js';

/**
 * The only database client (§18.3), injected into services and platform modules. It connects on
 * the first query, so a process starts while PostgreSQL is still unavailable (§17.2). It carries
 * the client extension of `@casl/prisma`: a query whose `accessibleBy` filter allows no record
 * returns no record instead of failing.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(TRYBUN_CONFIG) config: TrybunConfig) {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
    // The extended client delegates to this one, so Nest keeps one client with its lifecycle hook.
    return this.$extends(createCaslExtension()) as unknown as this;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/** The client of an interactive transaction (§18.3), passed to collaborators as `tx`. */
export type Transaction = Prisma.TransactionClient;
