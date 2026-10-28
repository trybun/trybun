'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AddOrganizationMemberDto,
  CreateOrganizationDto,
  Organization,
  UpdateOrganizationDto,
} from '@trybun/contracts/organizations';
import { dataOf } from '../../lib/api-client/api-client.js';
import { browserApiClient } from '../../lib/api-client/browser-api-client.js';
import { currentUserQueryOptions } from '../users/queries.js';

/** The weak ETag of the version the Administrator has seen (§17.2). */
function ifMatch(organization: Pick<Organization, 'version'>) {
  return { 'If-Match': `W/"${organization.version}"` };
}

/** An organization as a change addresses it: its ID and the version the Administrator has seen. */
type OrganizationVersion = Pick<Organization, 'id' | 'version'>;

/**
 * Invalidates every query of the organizations: lists, the detail and the members. A change of
 * one organization can move it between the lists (archiving), change its member count or the
 * organizations with access to a project.
 */
function useInvalidateOrganizations() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['organizations'] });
}

/** Creates an organization (§7.3); the getting-started checklist may tick its item. */
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const invalidateOrganizations = useInvalidateOrganizations();
  return useMutation({
    mutationFn: (input: CreateOrganizationDto) =>
      dataOf(browserApiClient.POST('/api/v1/organizations', { body: input })),
    onSuccess: async () => {
      await Promise.all([
        invalidateOrganizations(),
        queryClient.invalidateQueries({
          queryKey: currentUserQueryOptions(browserApiClient).queryKey,
        }),
      ]);
    },
  });
}

/** Changes the name, the e-mail domains or the projects of an organization; a list replaces the set. */
export function useUpdateOrganization() {
  const invalidateOrganizations = useInvalidateOrganizations();
  return useMutation({
    mutationFn: ({
      organization,
      input,
    }: {
      organization: OrganizationVersion;
      input: UpdateOrganizationDto;
    }) =>
      dataOf(
        browserApiClient.PATCH('/api/v1/organizations/{organizationId}', {
          params: { path: { organizationId: organization.id } },
          headers: ifMatch(organization),
          body: input,
        }),
      ),
    onSuccess: invalidateOrganizations,
  });
}

/** Archives an organization (§7.3); the response carries the version Undo sends. */
export function useArchiveOrganization() {
  const invalidateOrganizations = useInvalidateOrganizations();
  return useMutation({
    mutationFn: (organization: OrganizationVersion) =>
      dataOf(
        browserApiClient.PUT('/api/v1/organizations/{organizationId}/archive', {
          params: { path: { organizationId: organization.id } },
          headers: ifMatch(organization),
        }),
      ),
    onSuccess: invalidateOrganizations,
  });
}

/** Unarchives an organization (§7.3), also as the Undo of archiving. */
export function useUnarchiveOrganization() {
  const invalidateOrganizations = useInvalidateOrganizations();
  return useMutation({
    mutationFn: (organization: OrganizationVersion) =>
      dataOf(
        browserApiClient.DELETE('/api/v1/organizations/{organizationId}/archive', {
          params: { path: { organizationId: organization.id } },
          headers: ifMatch(organization),
        }),
      ),
    onSuccess: invalidateOrganizations,
  });
}

/** Deletes an organization (§7.3); it cannot be undone. */
export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organization: OrganizationVersion) =>
      dataOf(
        browserApiClient.DELETE('/api/v1/organizations/{organizationId}', {
          params: { path: { organizationId: organization.id } },
          headers: ifMatch(organization),
        }),
      ),
    onSuccess: (_data, organization) => {
      // The deleted organization's own queries would only answer 404 now.
      queryClient.removeQueries({ queryKey: ['organizations', 'detail', organization.id] });
      queryClient.removeQueries({ queryKey: ['organizations', 'members', organization.id] });
      return queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] });
    },
  });
}

/**
 * Adds an end user to an organization by e-mail address (§7.3); `move` confirms moving them from
 * another organization. Memberships have no version.
 */
export function useAddOrganizationMember(organizationId: string) {
  const invalidateOrganizations = useInvalidateOrganizations();
  return useMutation({
    mutationFn: (input: AddOrganizationMemberDto) =>
      dataOf(
        browserApiClient.POST('/api/v1/organizations/{organizationId}/members', {
          params: { path: { organizationId } },
          body: input,
        }),
      ),
    // A conflict means the members changed elsewhere: refresh them too.
    onSettled: () => invalidateOrganizations(),
  });
}

/** Removes a member from an organization (§7.3). */
export function useRemoveOrganizationMember(organizationId: string) {
  const invalidateOrganizations = useInvalidateOrganizations();
  return useMutation({
    mutationFn: (userId: string) =>
      dataOf(
        browserApiClient.DELETE('/api/v1/organizations/{organizationId}/members/{userId}', {
          params: { path: { organizationId, userId } },
        }),
      ),
    onSuccess: () => invalidateOrganizations(),
  });
}
