import type { UserKind } from '@trybun/contracts/users';

/** The person whose name a response would show, as the identity rule reads them (§5.4). */
export interface IdentityPerson {
  id: string;
  kind: UserKind;
  /** Whether the person currently belongs to the same organization as the viewer. */
  sharesOrganizationWithViewer: boolean;
}

/** The reader of a response. */
export interface IdentityViewer {
  id: string;
  kind: UserKind;
}

/**
 * Whether a viewer sees a person's name (§5.4, S1-11 Q9): a team member sees everyone, everyone
 * sees team members and themselves, and an end user sees the customers who currently belong to
 * their own organization – active or archived; two people without an organization never count as
 * the same organization. Otherwise the response carries none, and the web application shows
 * "Customer". S1-12 reuses it for comment authors.
 */
export function identityVisibleTo(viewer: IdentityViewer, person: IdentityPerson): boolean {
  return (
    viewer.kind === 'team' ||
    person.kind === 'team' ||
    viewer.id === person.id ||
    person.sharesOrganizationWithViewer
  );
}
