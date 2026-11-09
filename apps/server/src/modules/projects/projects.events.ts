import { z } from 'zod';

/**
 * A team member lost their role in a project (§7.4): removed from it, or – from S1-20 – converted
 * to an end user. S1-05 unassigns their open tickets of the project.
 */
export const PROJECT_MEMBER_REMOVED = 'project_member.removed';

/** The payload of `project_member.removed`: identifiers only. */
export const projectMemberRemovedPayloadSchema = z.object({
  projectId: z.uuid(),
  userId: z.uuid(),
});
export type ProjectMemberRemovedPayload = z.infer<typeof projectMemberRemovedPayloadSchema>;
