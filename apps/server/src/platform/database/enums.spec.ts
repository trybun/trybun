// Every Prisma enum has the values of its contract enum (§18.4).
import { activityEventSourceSchema } from '@trybun/contracts/activity-events';
import { invitationTargetTypeSchema } from '@trybun/contracts/invitations';
import { organizationStateSchema } from '@trybun/contracts/organizations';
import { productTourStatusSchema } from '@trybun/contracts/product-tours';
import { projectMemberRoleSchema, projectStateSchema } from '@trybun/contracts/projects';
import {
  ticketPrioritySchema,
  ticketSourceSchema,
  ticketStatusSchema,
  ticketTypeSchema,
} from '@trybun/contracts/tickets';
import { userKindSchema, userStateSchema } from '@trybun/contracts/users';
import { describe, expect, it } from 'vitest';
import {
  ActivityEventSource,
  InvitationTarget,
  OrganizationState,
  ProductTourStatus,
  ProjectRole,
  ProjectState,
  TicketPriority,
  TicketSource,
  TicketStatus,
  TicketType,
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
    ['TicketType', TicketType, ticketTypeSchema.options],
    ['TicketSource', TicketSource, ticketSourceSchema.options],
    ['TicketPriority', TicketPriority, ticketPrioritySchema.options],
    ['TicketStatus', TicketStatus, ticketStatusSchema.options],
    ['ActivityEventSource', ActivityEventSource, activityEventSourceSchema.options],
  ])('%s matches its contract enum', (_name, prismaEnum, contractValues) => {
    expect(Object.values(prismaEnum)).toEqual(contractValues);
  });
});
