import { z } from 'zod';
import { pageQuerySchema, pageSchema } from '../pagination/index.js';
import { projectMemberRoleSchema } from '../projects/index.js';
import { emailSchema, languageSchema, passwordSchema, userKindSchema } from '../users/index.js';

/** `invitation.target` (§7.4): what an invitation grants when it is accepted. */
export const invitationTargetTypeSchema = z.enum(['project', 'organization', 'administrator']);
export type InvitationTargetType = z.infer<typeof invitationTargetTypeSchema>;

/**
 * The state of an invitation (§7.4), derived from its timestamps and never stored: `pending`
 * (neither used nor revoked, not expired), `accepted`, `revoked`, `expired`.
 */
export const invitationStateSchema = z.enum(['pending', 'accepted', 'revoked', 'expired']);
export type InvitationState = z.infer<typeof invitationStateSchema>;

/** The action codes of an invitation (§18.3), sent in its `allowedActions`. */
export const invitationActionSchema = z.enum(['resend', 'revoke']);
export type InvitationAction = z.infer<typeof invitationActionSchema>;

/** The days an invitation is valid after it was issued or resent (§7.4, AQ5). */
export const INVITATION_VALIDITY_DAYS = 7;

/**
 * The target of a new invitation (§7.4): a project with a role (`end_user` invites an end user,
 * a team role a team member), an organization (an end user), or the Administrator role (a team
 * member).
 */
export const invitationTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('project'), projectId: z.uuid(), role: projectMemberRoleSchema }),
  z.object({ type: z.literal('organization'), organizationId: z.uuid() }),
  z.object({ type: z.literal('administrator') }),
]);
export type InvitationTarget = z.infer<typeof invitationTargetSchema>;

/** `POST /api/v1/invitation-previews` and `POST /api/v1/invitations` */
export const createInvitationSchema = z.object({
  email: emailSchema,
  target: invitationTargetSchema,
});
export type CreateInvitationDto = z.input<typeof createInvitationSchema>;
export type CreateInvitationInput = z.output<typeof createInvitationSchema>;

/** An organization as an invitation names it. */
const invitationOrganizationSchema = z.object({ id: z.uuid(), name: z.string() });

/**
 * `POST /api/v1/invitation-previews`: what issuing would do – a new invitation (`invite`, with the
 * organization the person will join by their e-mail domain, §7.3) or the access granted directly
 * to an existing account (`grant`). A refusal is the error the creation would return.
 */
export const invitationPreviewSchema = z.object({
  outcome: z.enum(['invite', 'grant']),
  organization: invitationOrganizationSchema.nullable(),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

/** The target of an issued invitation, with the name of its project or organization. */
export const invitationTargetDetailSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('project'),
    project: z.object({ id: z.uuid(), key: z.string(), name: z.string() }),
    role: projectMemberRoleSchema,
    /** The organization matched by the e-mail domain when the invitation was issued (§7.3). */
    organization: invitationOrganizationSchema.nullable(),
  }),
  z.object({ type: z.literal('organization'), organization: invitationOrganizationSchema }),
  z.object({ type: z.literal('administrator') }),
]);
export type InvitationTargetDetail = z.infer<typeof invitationTargetDetailSchema>;

/** An invitation (§7.4). It never contains the token or its hash. */
export const invitationSchema = z.object({
  id: z.uuid(),
  user: z.object({
    id: z.uuid(),
    email: z.string().nullable(),
    displayName: z.string().nullable(),
  }),
  target: invitationTargetDetailSchema,
  invitedBy: z.object({ id: z.uuid(), displayName: z.string().nullable() }).nullable(),
  state: invitationStateSchema,
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  allowedActions: z.array(invitationActionSchema),
});
export type Invitation = z.infer<typeof invitationSchema>;

/**
 * The invitation link `https://<domain>/invitations#token=<token>` (ADR 0009). Only its hash is
 * stored, so it is returned only by the response that created the token: issuing and resending.
 */
export const invitationLinkSchema = z.url();

/** `POST /api/v1/invitations`: `201` with a new invitation, or `200` with the access granted. */
export const createdInvitationSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('invited'),
    invitation: invitationSchema,
    link: invitationLinkSchema,
  }),
  z.object({
    outcome: z.literal('access_granted'),
    user: z.object({ id: z.uuid(), displayName: z.string().nullable() }),
  }),
]);
export type CreatedInvitation = z.infer<typeof createdInvitationSchema>;

/** `POST /api/v1/invitations/{invitationId}/resending`: a new token, the old link stops working. */
export const resentInvitationSchema = z.object({
  invitation: invitationSchema,
  link: invitationLinkSchema,
});
export type ResentInvitation = z.infer<typeof resentInvitationSchema>;

/** The path parameters of an invitation. */
export const invitationParamsSchema = z.object({ invitationId: z.uuid() });
export type InvitationParams = z.infer<typeof invitationParamsSchema>;

/**
 * `GET /api/v1/invitations`: the invitations of a project, an organization or an account, newest
 * first; pending ones by default.
 */
export const listInvitationsQuerySchema = pageQuerySchema.extend({
  projectId: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  userId: z.uuid().optional(),
  state: invitationStateSchema.default('pending'),
});
export type ListInvitationsQuery = z.infer<typeof listInvitationsQuerySchema>;

export const invitationPageSchema = pageSchema(invitationSchema);
export type InvitationPage = z.infer<typeof invitationPageSchema>;

/** The token of an invitation link (ADR 0009): 32 random bytes in base64url. */
export const invitationTokenSchema = z.string().min(1).max(128);

/** `POST /api/v1/invitations/token-verification`: checks a link before the acceptance page. */
export const verifyInvitationTokenSchema = z.object({ token: invitationTokenSchema });
export type VerifyInvitationTokenDto = z.infer<typeof verifyInvitationTokenSchema>;

/**
 * What the acceptance page shows for a valid link (ADR 0009): the invited address (read-only), the
 * kind of the account – a team member accepts with GitHub, an end user with a password or a
 * configured provider – the target and the inviting person. `accountState` is `active` for a
 * further link of an account that exists, which only a session of that account accepts (§7.4).
 */
export const invitationToAcceptSchema = z.object({
  email: z.string(),
  kind: userKindSchema,
  accountState: z.enum(['invited', 'active']),
  target: invitationTargetDetailSchema,
  invitedBy: z.object({ displayName: z.string().nullable() }).nullable(),
  expiresAt: z.iso.datetime(),
});
export type InvitationToAccept = z.infer<typeof invitationToAcceptSchema>;

/** The names of the person, which the user profile of Keycloak requires (ADR 0009). */
const personNameSchema = z.string().trim().min(1).max(100);

/**
 * `POST /api/v1/invitations/acceptance` (ADR 0009): `password` – an end user sets the password on
 * the acceptance page and the API creates the Keycloak user; `identity_provider` – the request
 * carries the access token of a sign-in through GitHub, Microsoft or Google started from the link.
 * The language is that of the acceptance page (§13.1); the time zone is the browser's, kept only
 * when it is a valid IANA name.
 */
export const acceptInvitationSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('password'),
    token: invitationTokenSchema,
    firstName: personNameSchema,
    lastName: personNameSchema,
    password: passwordSchema,
    language: languageSchema,
    timeZone: z.string().max(64).optional(),
  }),
  z.object({
    method: z.literal('identity_provider'),
    token: invitationTokenSchema,
    language: languageSchema,
    timeZone: z.string().max(64).optional(),
  }),
]);
export type AcceptInvitationDto = z.infer<typeof acceptInvitationSchema>;

/**
 * The accepted invitation: the account's kind – a new team member signs in again for the 2FA
 * set-up (ADR 0009) – and the path to land on: the invited project's home, else the root (the
 * portal for end users, the team home for the team).
 */
export const acceptedInvitationSchema = z.object({
  kind: userKindSchema,
  landingPath: z.string().startsWith('/'),
});
export type AcceptedInvitation = z.infer<typeof acceptedInvitationSchema>;
