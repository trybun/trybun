'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AddProjectMemberDto,
  CreateProjectDto,
  Project,
  ProjectRole,
  UpdateProjectDto,
} from '@trybun/contracts/projects';
import { dataOf } from '../../lib/api-client/api-client.js';
import { browserApiClient } from '../../lib/api-client/browser-api-client.js';
import { currentUserQueryOptions } from '../users/queries.js';

/** The weak ETag of the version the person has seen (§17.2). */
function ifMatch(project: Pick<Project, 'version'>) {
  return { 'If-Match': `W/"${project.version}"` };
}

/** A project as a change addresses it: its ID and the version the person has seen. */
type ProjectVersion = Pick<Project, 'id' | 'version'>;

/**
 * Invalidates every query of the projects: lists, the detail and the members. A change of one
 * project can move it between the lists (archiving) or change its actions; a change of a
 * membership can change the principal's own role and actions (a Project manager who demotes or
 * removes themselves).
 */
function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['projects'] });
}

/** Creates a project (§3.1); the getting-started checklist may tick its item. */
export function useCreateProject() {
  const queryClient = useQueryClient();
  const invalidateProjects = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: CreateProjectDto) =>
      dataOf(browserApiClient.POST('/api/v1/projects', { body: input })),
    onSuccess: async () => {
      await Promise.all([
        invalidateProjects(),
        queryClient.invalidateQueries({
          queryKey: currentUserQueryOptions(browserApiClient).queryKey,
        }),
      ]);
    },
  });
}

/** Changes the name, the key or the settings of a project. */
export function useUpdateProject() {
  const invalidateProjects = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ project, input }: { project: ProjectVersion; input: UpdateProjectDto }) =>
      dataOf(
        browserApiClient.PATCH('/api/v1/projects/{projectId}', {
          params: { path: { projectId: project.id } },
          headers: ifMatch(project),
          body: input,
        }),
      ),
    onSuccess: invalidateProjects,
  });
}

/** Archives a project (§7.3); the response carries the version Undo sends. */
export function useArchiveProject() {
  const invalidateProjects = useInvalidateProjects();
  return useMutation({
    mutationFn: (project: ProjectVersion) =>
      dataOf(
        browserApiClient.PUT('/api/v1/projects/{projectId}/archive', {
          params: { path: { projectId: project.id } },
          headers: ifMatch(project),
        }),
      ),
    onSuccess: invalidateProjects,
  });
}

/** Unarchives a project (§7.3), also as the Undo of archiving. */
export function useUnarchiveProject() {
  const invalidateProjects = useInvalidateProjects();
  return useMutation({
    mutationFn: (project: ProjectVersion) =>
      dataOf(
        browserApiClient.DELETE('/api/v1/projects/{projectId}/archive', {
          params: { path: { projectId: project.id } },
          headers: ifMatch(project),
        }),
      ),
    onSuccess: invalidateProjects,
  });
}

/** Deletes a project (§7.3); it cannot be undone. */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (project: ProjectVersion) =>
      dataOf(
        browserApiClient.DELETE('/api/v1/projects/{projectId}', {
          params: { path: { projectId: project.id } },
          headers: ifMatch(project),
        }),
      ),
    onSuccess: (_data, project) => {
      // The deleted project's own queries would only answer 404 now.
      queryClient.removeQueries({ queryKey: ['projects', 'detail', project.id] });
      return queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
    },
  });
}

/** Adds an active team account to a project (§7.4). */
export function useAddProjectMember(projectId: string) {
  const invalidateProjects = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: AddProjectMemberDto) =>
      dataOf(
        browserApiClient.POST('/api/v1/projects/{projectId}/members', {
          params: { path: { projectId } },
          body: input,
        }),
      ),
    // A conflict means the members changed elsewhere: refresh them and the candidates too.
    onSettled: () => invalidateProjects(),
  });
}

/** Changes the team role of a member (§7.4). Memberships have no version. */
export function useChangeProjectMemberRole(projectId: string) {
  const invalidateProjects = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ProjectRole }) =>
      dataOf(
        browserApiClient.PATCH('/api/v1/projects/{projectId}/members/{userId}', {
          params: { path: { projectId, userId } },
          body: { role },
        }),
      ),
    onSuccess: () => invalidateProjects(),
  });
}

/** Removes a member from a project (§7.4). */
export function useRemoveProjectMember(projectId: string) {
  const invalidateProjects = useInvalidateProjects();
  return useMutation({
    mutationFn: (userId: string) =>
      dataOf(
        browserApiClient.DELETE('/api/v1/projects/{projectId}/members/{userId}', {
          params: { path: { projectId, userId } },
        }),
      ),
    onSuccess: () => invalidateProjects(),
  });
}
