import { z } from 'zod';
import {
  listSearchQuerySchema,
  oneOrMore,
  pageQuerySchema,
  pageSchema,
} from '../pagination/index.js';
import { projectStateSchema } from '../projects/index.js';
import { emailSchema, userStateSchema } from '../users/index.js';

/** `organization.state` (§7.3): an archived organization is read-only until it is unarchived. */
export const organizationStateSchema = z.enum(['active', 'archived']);
export type OrganizationState = z.infer<typeof organizationStateSchema>;

/**
 * The action codes of an organization (§18.3), sent in its `allowedActions`. `update` changes the
 * name and the e-mail domains, `manage_projects` the projects it may access, `manage_members` its
 * members (§7.5).
 */
export const organizationActionSchema = z.enum([
  'read',
  'update',
  'archive',
  'unarchive',
  'delete',
  'manage_projects',
  'manage_members',
]);
export type OrganizationAction = z.infer<typeof organizationActionSchema>;

/** The name of an organization: trimmed, 1–100 characters, unique case-insensitively (§7.3). */
export const ORGANIZATION_NAME_MAX_LENGTH = 100;
export const organizationNameSchema = z.string().trim().min(1).max(ORGANIZATION_NAME_MAX_LENGTH);

/**
 * An e-mail domain as entered, e.g. `company.com` or `bücher.de`. The API normalizes it to
 * lower-case ASCII and checks its format and the blocklist of public mail domains (§7.3).
 */
export const ORGANIZATION_DOMAIN_MAX_LENGTH = 253;
export const organizationDomainInputSchema = z
  .string()
  .trim()
  .min(1)
  .max(ORGANIZATION_DOMAIN_MAX_LENGTH);

/** The most e-mail domains and projects one organization has. */
export const ORGANIZATION_MAX_DOMAINS = 50;
export const ORGANIZATION_MAX_PROJECTS = 100;

/** `POST /api/v1/organizations` */
export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  domains: z.array(organizationDomainInputSchema).max(ORGANIZATION_MAX_DOMAINS).default([]),
});
export type CreateOrganizationDto = z.input<typeof createOrganizationSchema>;
export type CreateOrganizationInput = z.output<typeof createOrganizationSchema>;

/**
 * `PATCH /api/v1/organizations/{organizationId}`: the fields to change, at least one. A list
 * replaces the whole set.
 */
export const updateOrganizationSchema = z
  .object({
    name: organizationNameSchema.optional(),
    domains: z.array(organizationDomainInputSchema).max(ORGANIZATION_MAX_DOMAINS).optional(),
    projectIds: z.array(z.uuid()).max(ORGANIZATION_MAX_PROJECTS).optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined));
export type UpdateOrganizationDto = z.infer<typeof updateOrganizationSchema>;

/**
 * A project an organization may access (§7.3); the access to an archived project can be neither
 * granted nor removed.
 */
export const organizationProjectSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
  state: projectStateSchema,
});
export type OrganizationProject = z.infer<typeof organizationProjectSchema>;

/** The fields of an organization in lists and its detail (§7.3). */
const organizationFields = {
  id: z.uuid(),
  name: z.string(),
  state: organizationStateSchema,
  /** The e-mail domains, normalized and sorted. */
  domains: z.array(z.string()),
  memberCount: z.int(),
  version: z.int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  allowedActions: z.array(organizationActionSchema),
};

/** An organization in the list (§7.3). */
export const organizationSummarySchema = z.object(organizationFields);
export type OrganizationSummary = z.infer<typeof organizationSummarySchema>;

/** An organization with the projects it may access (§7.3). */
export const organizationSchema = z.object({
  ...organizationFields,
  projects: z.array(organizationProjectSchema),
  /**
   * Whether a ticket has the organization as its snapshot (§3.2): it cannot be deleted. A fact for
   * hints of the UI only; the API enforces the rule.
   */
  hasTickets: z.boolean(),
});
export type Organization = z.infer<typeof organizationSchema>;

/** The path parameters of an organization. */
export const organizationParamsSchema = z.object({ organizationId: z.uuid() });
export type OrganizationParams = z.infer<typeof organizationParamsSchema>;

/**
 * `GET /api/v1/organizations`: the organizations in one state, sorted by name; `projectId` keeps
 * those that may access the project (the project settings, §7.3), `query` searches the name and
 * `id` keeps only the given organizations (the pickers of the ticket list filters, §8.1); all are
 * combined with AND. The Administrator reads every organization; another team member only the
 * names of those with access to one of their projects (S1-13 Q6).
 */
export const listOrganizationsQuerySchema = pageQuerySchema.extend({
  state: organizationStateSchema.default('active'),
  projectId: z.uuid().optional(),
  query: listSearchQuerySchema,
  id: oneOrMore(z.uuid()).optional(),
});
export type ListOrganizationsQuery = z.output<typeof listOrganizationsQuerySchema>;

/**
 * An organization as a team member reads it for the filters of the team views (S1-13 Q6): only its
 * ID and name, for the organizations with access to one of their projects.
 */
export const organizationNameItemSchema = z.object({ id: z.uuid(), name: z.string() });
export type OrganizationNameItem = z.infer<typeof organizationNameItemSchema>;

/**
 * The items of `GET /api/v1/organizations`: the summary for the Administrator, the name for other
 * team members (S1-13 Q6).
 */
export const organizationListItemSchema = z.union([
  organizationSummarySchema,
  organizationNameItemSchema,
]);
export type OrganizationListItem = z.infer<typeof organizationListItemSchema>;

/** Whether an item of the organization list is the Administrator's summary. */
export function isOrganizationSummary(item: OrganizationListItem): item is OrganizationSummary {
  return 'state' in item;
}

export const organizationPageSchema = pageSchema(organizationListItemSchema);
export type OrganizationPage = z.infer<typeof organizationPageSchema>;

/** `organization_member` (§7.3): an end-user account of an organization and the date it joined. */
export const organizationMemberSchema = z.object({
  user: z.object({
    id: z.uuid(),
    displayName: z.string().nullable(),
    email: z.string().nullable(),
    state: userStateSchema,
  }),
  createdAt: z.iso.datetime(),
});
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;

/** The path parameters of a member of an organization. */
export const organizationMemberParamsSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
});
export type OrganizationMemberParams = z.infer<typeof organizationMemberParamsSchema>;

/** `GET /api/v1/organizations/{organizationId}/members`, sorted by display name. */
export const listOrganizationMembersQuerySchema = pageQuerySchema;
export type ListOrganizationMembersQuery = z.infer<typeof listOrganizationMembersQuerySchema>;

export const organizationMemberPageSchema = pageSchema(organizationMemberSchema);
export type OrganizationMemberPage = z.infer<typeof organizationMemberPageSchema>;

/**
 * `POST /api/v1/organizations/{organizationId}/members`: an end-user account by its e-mail
 * address; `move` confirms moving it from another organization (§7.3).
 */
export const addOrganizationMemberSchema = z.object({
  email: emailSchema,
  move: z.boolean().default(false),
});
export type AddOrganizationMemberDto = z.input<typeof addOrganizationMemberSchema>;
export type AddOrganizationMemberInput = z.output<typeof addOrganizationMemberSchema>;
