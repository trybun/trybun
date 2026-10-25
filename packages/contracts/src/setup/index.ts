import { z } from 'zod';
import { languageSchema, timeZoneSchema } from '../users/index.js';

/**
 * Whether the first-run wizard is available (§15.6): `available` while no Administrator exists,
 * `completed` – permanently – afterwards.
 */
export const setupStatusSchema = z.enum(['available', 'completed']);
export type SetupStatus = z.infer<typeof setupStatusSchema>;

/**
 * The state of the first-run wizard (`GET /api/v1/setup`) with the system default language and
 * time zone of `.env`, which the wizard shows and uses as the defaults of the form (§15.6).
 */
export const setupSchema = z.object({
  status: setupStatusSchema,
  defaultLanguage: languageSchema,
  defaultTimeZone: z.string(),
});
export type Setup = z.infer<typeof setupSchema>;

/** The one-time setup token of the setup link (§15.6): 32 random bytes in base64url. */
export const setupTokenSchema = z.string().min(1).max(128);

/**
 * Checks a setup token before the form is shown (`POST /api/v1/setup/token-verification`); a
 * valid token returns the state of the wizard.
 */
export const verifySetupTokenSchema = z.object({ token: setupTokenSchema });
export type VerifySetupTokenDto = z.infer<typeof verifySetupTokenSchema>;

/**
 * Creates the first Administrator, the break-glass account of §7.4
 * (`POST /api/v1/setup/administrator`). The display name is the first and the last name, which
 * the user profile of Keycloak requires. The password goes to Keycloak, whose password policy
 * applies; the system never stores it.
 */
export const createAdministratorSchema = z.object({
  token: setupTokenSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  password: z.string().min(1).max(256),
  language: languageSchema,
  timeZone: timeZoneSchema,
});
export type CreateAdministratorDto = z.infer<typeof createAdministratorSchema>;

/** The account the wizard created (`POST /api/v1/setup/administrator`, `201`). */
export const createdAdministratorSchema = z.object({ id: z.uuid() });
export type CreatedAdministrator = z.infer<typeof createdAdministratorSchema>;
