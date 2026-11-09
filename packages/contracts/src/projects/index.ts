import { z } from 'zod';
import { pageQuerySchema, pageSchema } from '../pagination/index.js';

/** `project.state` (§7.3): an archived project is read-only until it is unarchived. */
export const projectStateSchema = z.enum(['active', 'archived']);
export type ProjectState = z.infer<typeof projectStateSchema>;

/** `project_member.role` (§7.2): the team roles of a project. */
export const projectRoleSchema = z.enum(['developer', 'project_manager']);
export type ProjectRole = z.infer<typeof projectRoleSchema>;

/**
 * Every value of `project_member.role`: the team roles and `end_user`, the personal access of an
 * end user who belongs to no organization with the project (§7.3, §7.4).
 */
export const projectMemberRoleSchema = z.enum([...projectRoleSchema.options, 'end_user']);
export type ProjectMemberRole = z.infer<typeof projectMemberRoleSchema>;

/**
 * The action codes of a project (§18.3), sent in its `allowedActions`. `update` changes the name
 * and the key, `update_settings` the project settings (resolution confirmation), `create_ticket`
 * creates a ticket in it (§3.2). `assign_tickets` assigns anyone eligible to its tickets and
 * `assign_tickets_self` only the principal, so the full form knows its assignee control before the
 * ticket exists (S1-10 Q15); the ticket's own `assign` / `assign_self` decide on a ticket.
 * `create_ticket_my_organization` and `create_ticket_all_customers` tell the form which visibility
 * a new ticket may get besides `only_me` (S1-11 Q7): the first only where the person's active
 * organization has access to the project (Q19).
 */
export const projectActionSchema = z.enum([
  'read',
  'update',
  'update_settings',
  'archive',
  'unarchive',
  'delete',
  'read_members',
  'manage_members',
  'create_ticket',
  'assign_tickets',
  'assign_tickets_self',
  'create_ticket_my_organization',
  'create_ticket_all_customers',
]);
export type ProjectAction = z.infer<typeof projectActionSchema>;

/** `project.key` (§3.1): a capital letter, then 1–9 capitals or digits, e.g. `ERP`. */
export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;
export const projectKeySchema = z.string().regex(PROJECT_KEY_PATTERN);

/** The name of a project: trimmed, 1–100 characters, not unique (§3.1). */
export const PROJECT_NAME_MAX_LENGTH = 100;
export const projectNameSchema = z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH);

/** `POST /api/v1/projects` */
export const createProjectSchema = z.object({
  name: projectNameSchema,
  key: projectKeySchema,
});
export type CreateProjectDto = z.infer<typeof createProjectSchema>;

/**
 * `PATCH /api/v1/projects/{projectId}`: the fields to change, at least one. A body with a field
 * the principal may not change is rejected as a whole (§18.3).
 */
export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    key: projectKeySchema.optional(),
    confirmResolution: z.boolean().optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined));
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;

/**
 * A project (§3.1) with the role of the principal in it – `null` for an Administrator who is not
 * a member – and the actions the principal may perform on it (§18.3).
 */
export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  key: z.string(),
  state: projectStateSchema,
  confirmResolution: z.boolean(),
  version: z.int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** The principal's own role in the project; `end_user` for personal access of an end user. */
  role: projectMemberRoleSchema.nullable(),
  /**
   * Whether a ticket was ever created in the project (§3.1): its key is frozen and it cannot be
   * deleted. A fact for hints of the UI only; the API enforces both rules.
   */
  hasTickets: z.boolean(),
  allowedActions: z.array(projectActionSchema),
});
export type Project = z.infer<typeof projectSchema>;

/**
 * A project as an end user sees it (Q7): without the settings, the version, the role, the facts
 * for the team's hints and the timestamps – end users never see what they cannot change.
 */
export const endUserProjectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  key: z.string(),
  state: projectStateSchema,
  allowedActions: z.array(projectActionSchema),
});
export type EndUserProject = z.infer<typeof endUserProjectSchema>;

/**
 * The response of a project read: the team's shape for team accounts, the end user's for end
 * users. The serializer keeps only the fields of the matching shape.
 */
export const projectResponseSchema = z.union([projectSchema, endUserProjectSchema]);
export type ProjectResponse = z.infer<typeof projectResponseSchema>;

/** The path parameters of a project. */
export const projectParamsSchema = z.object({ projectId: z.uuid() });
export type ProjectParams = z.infer<typeof projectParamsSchema>;

/** `GET /api/v1/projects`: the projects in one state, sorted by name. */
export const listProjectsQuerySchema = pageQuerySchema.extend({
  state: projectStateSchema.default('active'),
});
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export const projectPageSchema = pageSchema(projectResponseSchema);
export type ProjectPage = z.infer<typeof projectPageSchema>;

/** A team account as the members of a project show it: no e-mail address. */
export const projectAccountSchema = z.object({
  id: z.uuid(),
  displayName: z.string().nullable(),
  githubLogin: z.string().nullable(),
});
export type ProjectAccount = z.infer<typeof projectAccountSchema>;

/**
 * `project_member` (§7.4): a team account with its team role in the project, or an end user with
 * personal access (`end_user`, §7.3).
 */
export const projectMemberSchema = z.object({
  user: projectAccountSchema,
  role: projectMemberRoleSchema,
  createdAt: z.iso.datetime(),
});
export type ProjectMember = z.infer<typeof projectMemberSchema>;

/** The path parameters of a member of a project. */
export const projectMemberParamsSchema = z.object({ projectId: z.uuid(), userId: z.uuid() });
export type ProjectMemberParams = z.infer<typeof projectMemberParamsSchema>;

/** The longest search text of the member picker. */
export const MEMBER_CANDIDATE_QUERY_MAX_LENGTH = 100;

/**
 * `GET /api/v1/projects/{projectId}/members`, sorted by display name; `role` filters.
 * `assignable=true` keeps the members who can be assigned to the project's tickets (active team
 * accounts with a team role, §3.2), and `query` searches display name and GitHub login – the
 * assignee picker of the ticket view (S1-10 Q9).
 */
export const listProjectMembersQuerySchema = pageQuerySchema.extend({
  role: projectRoleSchema.optional(),
  assignable: z.stringbool().optional(),
  query: z.string().trim().max(MEMBER_CANDIDATE_QUERY_MAX_LENGTH).optional(),
});
export type ListProjectMembersQuery = z.infer<typeof listProjectMembersQuerySchema>;

export const projectMemberPageSchema = pageSchema(projectMemberSchema);
export type ProjectMemberPage = z.infer<typeof projectMemberPageSchema>;

/** `POST /api/v1/projects/{projectId}/members`: an active team account with a team role. */
export const addProjectMemberSchema = z.object({
  userId: z.uuid(),
  role: projectRoleSchema,
});
export type AddProjectMemberDto = z.infer<typeof addProjectMemberSchema>;

/** `PATCH /api/v1/projects/{projectId}/members/{userId}` */
export const changeProjectMemberRoleSchema = z.object({ role: projectRoleSchema });
export type ChangeProjectMemberRoleDto = z.infer<typeof changeProjectMemberRoleSchema>;

/**
 * `GET /api/v1/projects/{projectId}/member-candidates`: the active team accounts that are not
 * members of the project, searched by display name and GitHub login.
 */
export const listMemberCandidatesQuerySchema = pageQuerySchema.extend({
  query: z.string().trim().max(MEMBER_CANDIDATE_QUERY_MAX_LENGTH).optional(),
});
export type ListMemberCandidatesQuery = z.infer<typeof listMemberCandidatesQuerySchema>;

export const memberCandidatePageSchema = pageSchema(projectAccountSchema);
export type MemberCandidatePage = z.infer<typeof memberCandidatePageSchema>;
