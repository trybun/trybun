import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateAdministratorDto,
  CreatedAdministrator,
  Setup,
  VerifySetupTokenDto,
} from '@trybun/contracts/setup';
import { Clock } from '../../platform/clock/clock.js';
import { AuditLogEntriesService } from '../audit-log-entries/audit-log-entries.service.js';
import { TRYBUN_CONFIG } from '../../platform/config/config.module.js';
import type { TrybunConfig } from '../../platform/config/config.schema.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { AppError } from '../../platform/errors/app-error.js';
import {
  KEYCLOAK_ADMIN,
  type KeycloakAdmin,
} from '../../platform/keycloak-admin/keycloak-admin.js';
import { hashSetupToken, setupLink, setupTokenExpiry } from './domain/setup-token.js';

/** A new setup link printed by the `setup-token` command (§15.6). */
export interface IssuedSetupToken {
  link: string;
  expiresAt: Date;
}

/** The first-run wizard (§15.6): the setup token and the first Administrator. */
@Injectable()
export class SetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(KEYCLOAK_ADMIN) private readonly keycloak: KeycloakAdmin,
    @Inject(TRYBUN_CONFIG) private readonly config: TrybunConfig,
    private readonly auditLog: AuditLogEntriesService,
  ) {}

  /** Whether the wizard is available, with the system defaults of `.env` (§13.1). */
  async findSetup(): Promise<Setup> {
    return this.toSetup(await this.isCompleted(this.prisma));
  }

  /**
   * Issues a setup token valid for 24 hours and replaces every earlier one, so only the latest
   * link works. Refused once an Administrator exists.
   */
  async issueToken(): Promise<IssuedSetupToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = setupTokenExpiry(this.clock.now());
    await this.prisma.$transaction(async (tx) => {
      if (await this.isCompleted(tx)) {
        throw new AppError('setup.completed');
      }
      await tx.setupToken.deleteMany();
      await tx.setupToken.create({ data: { tokenHash: hashSetupToken(token), expiresAt } });
    });
    return { link: setupLink(this.config.domain, token), expiresAt };
  }

  /** Checks the token of the setup link before the wizard shows its form. */
  async verifyToken(input: VerifySetupTokenDto): Promise<Setup> {
    await this.assertTokenUsable(hashSetupToken(input.token));
    return this.toSetup(false);
  }

  /**
   * Creates the first Administrator, the break-glass account (§7.4): the Keycloak user with the
   * password and the required OTP set-up, then the account, claiming the token in the same
   * transaction, with the use of the token in the audit log (§13.5). Of two simultaneous requests
   * only one claims the token; when the transaction fails, the Keycloak user is deleted again, so
   * a retry starts clean.
   */
  async createAdministrator(
    input: CreateAdministratorDto,
    clientIp?: string,
  ): Promise<CreatedAdministrator> {
    const tokenHash = hashSetupToken(input.token);
    await this.assertTokenUsable(tokenHash);
    const email = input.email.toLowerCase();
    const keycloakUserId = await this.keycloak.createAdministrator({
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      password: input.password,
      language: input.language,
    });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const now = this.clock.now();
        const claimed = await tx.setupToken.updateMany({
          where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (claimed.count === 0) {
          throw new AppError('setup.token_invalid');
        }
        if (await this.isCompleted(tx)) {
          throw new AppError('setup.completed');
        }
        const created = await tx.user.create({
          data: {
            keycloakUserId,
            email,
            displayName: `${input.firstName} ${input.lastName}`,
            language: input.language,
            timeZone: input.timeZone,
            kind: 'team',
            isAdmin: true,
            state: 'active',
          },
          select: { id: true },
        });
        await this.auditLog.record(tx, {
          action: 'setup_token.used',
          actorId: created.id,
          target: { type: 'User', id: created.id },
          ipAddress: clientIp,
        });
        return created;
      });
    } catch (error) {
      await this.keycloak.deleteUser(keycloakUserId);
      throw error;
    }
  }

  /**
   * The wizard is disabled permanently once an Administrator exists (`setup.completed`); an
   * unknown, expired or used token gets one error (`setup.token_invalid`, §15.6).
   */
  private async assertTokenUsable(tokenHash: string): Promise<void> {
    if (await this.isCompleted(this.prisma)) {
      throw new AppError('setup.completed');
    }
    const token = await this.prisma.setupToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: this.clock.now() } },
      select: { id: true },
    });
    if (token === null) {
      throw new AppError('setup.token_invalid');
    }
  }

  private async isCompleted(db: Transaction): Promise<boolean> {
    return (await db.user.count({ where: { isAdmin: true } })) > 0;
  }

  private toSetup(isCompleted: boolean): Setup {
    return {
      status: isCompleted ? 'completed' : 'available',
      defaultLanguage: this.config.defaultLanguage,
      defaultTimeZone: this.config.defaultTimeZone,
    };
  }
}
