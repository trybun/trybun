import { Injectable } from '@nestjs/common';
import {
  type ProductTourId,
  type ProductTourProgress,
  type ProductTourProgressPage,
  productTourIdSchema,
  type RecordProductTourProgressDto,
} from '@trybun/contracts/product-tours';
import type { CurrentUser, CurrentUserAction } from '@trybun/contracts/users';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { ADMINISTRATION } from '../administration/administration.abilities.js';
import {
  CREATE as CREATE_ORGANIZATION,
  ORGANIZATION,
} from '../organizations/organizations.abilities.js';
import { CREATE, PROJECT } from '../projects/projects.abilities.js';

const PRODUCT_TOUR_PROGRESS_SELECT = {
  tourId: true,
  tourVersion: true,
  status: true,
  updatedAt: true,
} satisfies Prisma.ProductTourProgressSelect;

type ProductTourProgressRow = Prisma.ProductTourProgressGetPayload<{
  select: typeof PRODUCT_TOUR_PROGRESS_SELECT;
}>;

/** The response shape of a progress record (§18.3). */
function toProductTourProgressResponse(row: ProductTourProgressRow): ProductTourProgress {
  return {
    tourId: productTourIdSchema.parse(row.tourId),
    tourVersion: row.tourVersion,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
  ) {}

  /**
   * The account of the principal itself (§7.4) with its global actions (§18.3). The
   * authentication guard has already resolved it as an active account, so it exists.
   */
  async findCurrent(principal: UserPrincipal): Promise<CurrentUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { id: true, displayName: true, email: true, kind: true },
    });
    const ability = this.abilities.forPrincipal(principal);
    const allowedActions: CurrentUserAction[] = [];
    if (ability.can('read', ADMINISTRATION)) {
      allowedActions.push('open_administration');
    }
    if (ability.can(CREATE, PROJECT)) {
      allowedActions.push('create_project');
    }
    if (ability.can(CREATE_ORGANIZATION, ORGANIZATION)) {
      allowedActions.push('create_organization');
    }
    return { ...user, allowedActions };
  }

  /**
   * The product tour progress of the principal itself (§2.4). The list is bounded by the closed
   * list of tours, so it is one page (§18.4).
   */
  async findProductTourProgress(principal: UserPrincipal): Promise<ProductTourProgressPage> {
    const rows = await this.prisma.productTourProgress.findMany({
      // The progress of a tour that no longer exists is kept but not returned.
      where: { userId: principal.userId, tourId: { in: productTourIdSchema.options } },
      select: PRODUCT_TOUR_PROGRESS_SELECT,
      orderBy: { tourId: 'asc' },
    });
    return { items: rows.map(toProductTourProgressResponse), nextCursor: null };
  }

  /**
   * Records how the principal ended a tour (§2.4). The record belongs only to the principal and
   * has no version: the last write wins, as when two devices end the same tour.
   */
  async recordProductTourProgress(
    principal: UserPrincipal,
    tourId: ProductTourId,
    input: RecordProductTourProgressDto,
  ): Promise<ProductTourProgress> {
    const row = await this.prisma.productTourProgress.upsert({
      where: { userId_tourId: { userId: principal.userId, tourId } },
      create: { userId: principal.userId, tourId, ...input },
      update: input,
      select: PRODUCT_TOUR_PROGRESS_SELECT,
    });
    return toProductTourProgressResponse(row);
  }
}
