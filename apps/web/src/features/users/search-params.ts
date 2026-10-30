import { userKindSchema, userStateSchema } from '@trybun/contracts/users';
import { z } from 'zod';

/**
 * The URL state of the Accounts page (§18.5): the kind and state filters; an unknown value means
 * no filter. The search text is never part of the URL (§17.2).
 */
export const accountsSearchParamsSchema = z.object({
  kind: userKindSchema.optional().catch(undefined),
  state: userStateSchema.optional().catch(undefined),
});
export type AccountsSearchParams = z.infer<typeof accountsSearchParamsSchema>;

/** The address of the Accounts page of the Administrator panel. */
export const ACCOUNTS_HREF = '/admin/accounts';

/** The address of the Accounts page with filters. */
export function accountsHref({ kind, state }: AccountsSearchParams): string {
  const params = new URLSearchParams({
    ...(kind === undefined ? {} : { kind }),
    ...(state === undefined ? {} : { state }),
  });
  const query = params.toString();
  return query === '' ? ACCOUNTS_HREF : `${ACCOUNTS_HREF}?${query}`;
}

/** The address of the Account settings page (§13.1). */
export const SETTINGS_HREF = '/settings';
