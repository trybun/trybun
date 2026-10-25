import { z } from 'zod';

/** `user.kind` (§7.1): mutually exclusive kind of an account. */
export const userKindSchema = z.enum(['team', 'end_user']);
export type UserKind = z.infer<typeof userKindSchema>;

/** `user.state` (§7.4): lifecycle of an account. */
export const userStateSchema = z.enum(['invited', 'active', 'deactivated', 'anonymized']);
export type UserState = z.infer<typeof userStateSchema>;

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
 * current account. `open_administration` – the Administrator panel (§15.6).
 */
export const currentUserActionSchema = z.enum(['open_administration']);
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
  allowedActions: z.array(currentUserActionSchema),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;
