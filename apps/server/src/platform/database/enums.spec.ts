// Every Prisma enum has the values of its contract enum (§18.4).
import { invitationTargetTypeSchema } from '@trybun/contracts/invitations';
import { organizationStateSchema } from '@trybun/contracts/organizations';
import { productTourStatusSchema } from '@trybun/contracts/product-tours';
import { projectMemberRoleSchema, projectStateSchema } from '@trybun/contracts/projects';
import { userKindSchema, userStateSchema } from '@trybun/contracts/users';
import { describe, expect, it } from 'vitest';
import {
  InvitationTarget,
  OrganizationState,
  ProductTourStatus,
  ProjectRole,
  ProjectState,
  UserKind,
  UserState,
} from '../../generated/prisma/enums.js';

describe('Prisma enums', () => {
  it.each([
    ['UserKind', UserKind, userKindSchema.options],
    ['UserState', UserState, userStateSchema.options],
    ['ProductTourStatus', ProductTourStatus, productTourStatusSchema.options],
    ['ProjectState', ProjectState, projectStateSchema.options],
    ['ProjectRole', ProjectRole, projectMemberRoleSchema.options],
    ['OrganizationState', OrganizationState, organizationStateSchema.options],
    ['InvitationTarget', InvitationTarget, invitationTargetTypeSchema.options],
  ])('%s matches its contract enum', (_name, prismaEnum, contractValues) => {
    expect(Object.values(prismaEnum)).toEqual(contractValues);
  });
});
