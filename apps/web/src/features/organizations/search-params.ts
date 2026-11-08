import { organizationStateSchema } from '@trybun/contracts/organizations';
import { z } from 'zod';

/** The URL state of the Organizations page (§18.5): the tab of active or archived organizations. */
export const organizationsSearchParamsSchema = z.object({
  state: organizationStateSchema.catch('active'),
});
export type OrganizationsSearchParams = z.infer<typeof organizationsSearchParamsSchema>;

/** The address of the Organizations page of the Administrator panel. */
export const ORGANIZATIONS_HREF = '/admin/organizations';

/** The address of an organization in the Administrator panel. */
export function organizationHref(organizationId: string): string {
  return `${ORGANIZATIONS_HREF}/${organizationId}`;
}
