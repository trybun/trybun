import type { TicketPerson } from '@trybun/contracts/tickets';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { identityVisibleTo } from './domain/identities.js';

/**
 * A person and what the identity rule reads of them (§5.4): their account kind and whether their
 * current organization has the principal as a member. Every response that names a person to an
 * end user selects it – the requester and the actors of a ticket, the uploaders of its files.
 */
export function identitySelect(principal: UserPrincipal) {
  return {
    id: true,
    displayName: true,
    kind: true,
    organizationMember: {
      select: {
        organization: {
          select: { members: { where: { userId: principal.userId }, select: { userId: true } } },
        },
      },
    },
  } satisfies Prisma.UserSelect;
}

export type IdentityRow = Prisma.UserGetPayload<{ select: ReturnType<typeof identitySelect> }>;

/** A person in a response to the principal: `null` when the identity rule hides them (Q9). */
export function visiblePerson(principal: UserPrincipal, person: IdentityRow): TicketPerson | null {
  const isVisible = identityVisibleTo(
    { id: principal.userId, kind: principal.userKind },
    {
      id: person.id,
      kind: person.kind,
      sharesOrganizationWithViewer:
        (person.organizationMember?.organization.members.length ?? 0) > 0,
    },
  );
  return isVisible ? { id: person.id, displayName: person.displayName } : null;
}
