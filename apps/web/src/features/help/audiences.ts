import type { UserKind } from '@trybun/contracts/users';

/** The audiences of the user documentation, from the least to the most specific (§2.3). */
export const HELP_AUDIENCES = ['end-user', 'team', 'administrator'] as const;
export type HelpAudience = (typeof HELP_AUDIENCES)[number];

/** The Diátaxis categories of the user documentation (§2.3). */
export const HELP_CATEGORIES = ['tutorials', 'how-to', 'reference', 'explanation'] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number];

/**
 * The audiences whose pages an account kind receives (§2.3): the account kind decides only
 * between the portal and the team views (§18.5), so end users receive the end-user pages and the
 * team receives every page. The Administrator pages are meant for Administrators only, which needs
 * the API to name the reader's audiences (plan task S1-19).
 */
export const AUDIENCES_OF_KIND: Readonly<Record<UserKind, readonly HelpAudience[]>> = {
  end_user: ['end-user'],
  team: HELP_AUDIENCES,
};
