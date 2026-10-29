import { z } from 'zod';
import { pageQuerySchema, pageSchema } from '../pagination/index.js';

/** `user.kind` (§7.1): mutually exclusive kind of an account. */
export const userKindSchema = z.enum(['team', 'end_user']);
export type UserKind = z.infer<typeof userKindSchema>;

/** `user.state` (§7.4): lifecycle of an account. */
export const userStateSchema = z.enum(['invited', 'active', 'deactivated', 'anonymized']);
export type UserState = z.infer<typeof userStateSchema>;

/**
 * An e-mail address of an account (§7.4), normalized: trimmed and lower-cased, so addresses that
 * differ only in letter case are one account. `users.email` keeps only this form (a check
 * constraint of the migrations).
 */
export const EMAIL_MAX_LENGTH = 254;
export const emailSchema = z.string().trim().toLowerCase().max(EMAIL_MAX_LENGTH).pipe(z.email());

/**
 * The length rule of the password policy of the sign-in (§7.4): NIST SP 800-63B and OWASP ASVS
 * 5.0. Keycloak enforces the whole policy; these values must equal the `length()` and
 * `maxLength()` of `docker/keycloak/realm/trybun.yaml`, which the tests check.
 */
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 64;

/**
 * A password a person chooses, checked for its length before Keycloak checks the whole policy.
 * Zod and Keycloak (Java `String.length()`) both count UTF-16 code units.
 */
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

/** A supported language (§13.1): the languages of the message catalogues of `@trybun/i18n`. */
export const languageSchema = z.enum(['en', 'pl']);
export type Language = z.infer<typeof languageSchema>;

/** An IANA time-zone name known to the runtime, e.g. `Europe/Warsaw` (§13.1). */
export const timeZoneSchema = z
  .string()
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  });

/**
 * The global actions of an account (§18.3): actions that belong to no record, sent with the
 * current account. `open_administration` – the Administrator panel (§15.6); `create_project` –
 * creating a project, `create_organization` – creating an organization (§7.5).
 */
export const currentUserActionSchema = z.enum([
  'open_administration',
  'create_project',
  'create_organization',
]);
export type CurrentUserAction = z.infer<typeof currentUserActionSchema>;

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
  /** The language of the account (§13.1); `null` until it is set – the system default applies. */
  language: languageSchema.nullable(),
  /** The IANA time zone of the account (§13.1); `null` – the system default applies. */
  timeZone: z.string().nullable(),
  allowedActions: z.array(currentUserActionSchema),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

/**
 * `PATCH /api/v1/users/me`: the settings of the own account (§13.1), at least one;
 * `timeZone: null` returns to the system default.
 */
export const updateCurrentUserSchema = z
  .object({
    language: languageSchema.optional(),
    timeZone: timeZoneSchema.nullable().optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined));
export type UpdateCurrentUserDto = z.infer<typeof updateCurrentUserSchema>;

/**
 * The action codes of an account (§18.3), sent in its `allowedActions` on the Accounts page of
 * the Administrator (§7.4, §7.5).
 */
export const userActionSchema = z.enum(['deactivate', 'reactivate', 'grant_admin', 'revoke_admin']);
export type UserAction = z.infer<typeof userActionSchema>;

/** An account as the Accounts page of the Administrator lists it (§7.4). */
export const userSchema = z.object({
  id: z.uuid(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  kind: userKindSchema,
  state: userStateSchema,
  isAdmin: z.boolean(),
  githubLogin: z.string().nullable(),
  createdAt: z.iso.datetime(),
  allowedActions: z.array(userActionSchema),
});
export type User = z.infer<typeof userSchema>;

/** The path parameters of an account. */
export const userParamsSchema = z.object({ userId: z.uuid() });
export type UserParams = z.infer<typeof userParamsSchema>;

/** The longest search text of the accounts list. */
export const USER_QUERY_MAX_LENGTH = 100;

/**
 * `GET /api/v1/users`: the accounts of the Accounts page, sorted by display name; filtered by
 * kind and state, searched by display name and e-mail address.
 */
export const listUsersQuerySchema = pageQuerySchema.extend({
  kind: userKindSchema.optional(),
  state: userStateSchema.optional(),
  query: z.string().trim().max(USER_QUERY_MAX_LENGTH).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const userPageSchema = pageSchema(userSchema);
export type UserPage = z.infer<typeof userPageSchema>;
