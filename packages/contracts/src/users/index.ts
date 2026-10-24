import { z } from 'zod';

/** `user.kind` (§7.1): mutually exclusive kind of an account. */
export const userKindSchema = z.enum(['team', 'end_user']);
export type UserKind = z.infer<typeof userKindSchema>;

/** `user.state` (§7.4): lifecycle of an account. */
export const userStateSchema = z.enum(['invited', 'active', 'deactivated', 'anonymized']);
export type UserState = z.infer<typeof userStateSchema>;

/**
 * The account of the request's principal (`GET /api/v1/users/me`): what the application shell
 * shows in the user menu (§18.5). The account kind decides only between the portal and the team
 * views; permissions come from `allowedActions` (§14.4).
 */
export const currentUserSchema = z.object({
  id: z.uuid(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  kind: userKindSchema,
});
export type CurrentUser = z.infer<typeof currentUserSchema>;
