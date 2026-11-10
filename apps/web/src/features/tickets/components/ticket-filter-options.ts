'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  TICKET_FILTER_ME,
  TICKET_FILTER_NONE,
  type TicketListFilters,
  ticketPrioritySchema,
  ticketSharingRequestFilterSchema,
  ticketSourceSchema,
  ticketTypeSchema,
} from '@trybun/contracts/tickets';
import { useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import {
  assigneeFilterNamesQueryOptions,
  assigneeFilterSearchQueryOptions,
  type FilterRecord,
  organizationFilterNamesQueryOptions,
  organizationFilterSearchQueryOptions,
  projectFilterNamesQueryOptions,
  projectFilterSearchQueryOptions,
} from '../queries.js';
import { TICKET_LIST_FILTER_KEYS, type TicketListFilterKey } from '../ticket-list.js';
import { STATUS_KINDS } from './status-control.js';

/** A value of a filter with its label; `short` is what its chip shows, if not the label. */
export interface FilterOption {
  value: string;
  label: string;
  short?: string;
}

/** Options in groups (the statuses by kind); a group with an empty label is plain. */
export interface FilterGroup {
  label: string;
  options: FilterOption[];
}

/** The fields searched on the server: their records are unbounded (#279). */
export type EntityFilterKey = 'projectId' | 'organizationId' | 'assigneeId';

export function isEntityFilterKey(key: TicketListFilterKey): key is EntityFilterKey {
  return key === 'projectId' || key === 'organizationId' || key === 'assigneeId';
}

/** The values of a filter that are not records: "Me", "Unassigned", "No organization". */
const FIXED_VALUES: readonly string[] = [TICKET_FILTER_ME, TICKET_FILTER_NONE];

/** The chosen record IDs of an entity filter, without its fixed values. */
export function chosenRecordIds(filters: TicketListFilters, key: EntityFilterKey): string[] {
  return (filters[key] ?? []).filter((value) => !FIXED_VALUES.includes(value));
}

/**
 * The fields of the filter bar (§8.1): Organization only while organizations exist (§7.3, S1-13
 * Q6) – or while a link still filters by one, so its chip can be removed.
 */
export function useFilterFields(
  filters: TicketListFilters,
  organizationsExist: boolean,
): { key: TicketListFilterKey; label: string }[] {
  const tf = useTranslations('tickets.list.filters');
  return TICKET_LIST_FILTER_KEYS.filter(
    (key) => key !== 'organizationId' || organizationsExist || filters.organizationId !== undefined,
  ).map((key) => ({ key, label: tf(`names.${key}`) }));
}

/**
 * The options of a field that are not searched on the server: the catalogues of the fixed fields,
 * and the fixed first options of the entity fields – **Me** and **Unassigned** of Assignee, **No
 * organization** of Organization (S1-13).
 */
export function useFixedFilterGroups(): (
  key: TicketListFilterKey,
  filters: TicketListFilters,
) => FilterGroup[] {
  const t = useTranslations('tickets');
  const tf = useTranslations('tickets.list.filters');
  const plain = (options: FilterOption[]) => [{ label: '', options }];
  return (key, filters) => {
    switch (key) {
      case 'projectId':
        return [];
      case 'organizationId':
        return plain([{ value: TICKET_FILTER_NONE, label: tf('noOrganization') }]);
      case 'assigneeId':
        return plain([
          { value: TICKET_FILTER_ME, label: tf('me') },
          { value: TICKET_FILTER_NONE, label: tf('unassigned') },
        ]);
      case 'type':
        return plain([
          { value: TICKET_FILTER_NONE, label: tf('none') },
          ...ticketTypeSchema.options.map((type) => ({ value: type, label: t(`types.${type}`) })),
        ]);
      case 'status':
        return STATUS_KINDS.map(({ kind, statuses }) => ({
          label: t(`status.kinds.${kind}`),
          options: statuses.map((status) => ({ value: status, label: t(`statuses.${status}`) })),
        }));
      case 'priority':
        return plain(
          ticketPrioritySchema.options.map((priority) => ({
            value: priority,
            label: t(`priorities.${priority}`),
          })),
        );
      case 'source':
        // "Integration" is offered only once chosen: no integration exists yet (S1-13).
        return plain(
          ticketSourceSchema.options
            .filter(
              (source) => source !== 'integration' || filters.source?.includes(source) === true,
            )
            .map((source) => ({ value: source, label: t(`sources.${source}`) })),
        );
      case 'sharingRequest':
        return plain(
          ticketSharingRequestFilterSchema.options.map((value) => ({
            value,
            label: tf(`sharingRequests.${value}`),
          })),
        );
    }
  };
}

/** The option of a record; a deleted user has no name. */
export function useRecordOption() {
  const t = useTranslations('tickets');
  return ({ id, label, short }: FilterRecord): FilterOption => ({
    value: id,
    label: label ?? t('deletedUser'),
    ...(short === undefined ? {} : { short }),
  });
}

/**
 * One search of an entity field's picker (#279): projects and organizations by name in both
 * states, the people of the chosen projects – nobody before a project is chosen (S1-13 Q7);
 * `null` for a fixed field.
 */
export function useEntityFilterSearch(
  key: TicketListFilterKey,
  filters: TicketListFilters,
  search: string,
) {
  const projectIds = chosenRecordIds(filters, 'projectId');
  // One hook per list keeps each query's own types; only the field's own list is read.
  const projects = useQuery({
    ...projectFilterSearchQueryOptions(browserApiClient, search),
    enabled: key === 'projectId',
  });
  const organizations = useQuery({
    ...organizationFilterSearchQueryOptions(browserApiClient, search),
    enabled: key === 'organizationId',
  });
  const people = useQuery({
    ...assigneeFilterSearchQueryOptions(browserApiClient, projectIds, search),
    enabled: key === 'assigneeId' && projectIds.length > 0,
  });
  switch (key) {
    case 'projectId':
      return projects;
    case 'organizationId':
      return organizations;
    case 'assigneeId':
      return people;
    default:
      // A fixed field filters its few options on the client.
      return null;
  }
}

/**
 * The names of the chosen records of every entity filter, looked up by ID (#279): for the chips
 * and the pinned rows of the pickers, also beyond the first search page.
 *
 * `nameOf` answers the option of a value; "Unknown" for a record the person cannot see (S1-13 Q5),
 * and `undefined` while its lookup loads or after it failed – never "Unknown" for an error.
 */
export function useFilterValueNames(filters: TicketListFilters) {
  const tf = useTranslations('tickets.list.filters');
  const toOption = useRecordOption();
  // A toggle changes the IDs: the names known so far stay while the new lookup loads.
  const names = <Options extends object>(options: Options) => ({
    ...options,
    placeholderData: keepPreviousData,
  });
  const lookups = {
    projectId: useQuery(
      names(
        projectFilterNamesQueryOptions(browserApiClient, chosenRecordIds(filters, 'projectId')),
      ),
    ),
    organizationId: useQuery(
      names(
        organizationFilterNamesQueryOptions(
          browserApiClient,
          chosenRecordIds(filters, 'organizationId'),
        ),
      ),
    ),
    assigneeId: useQuery(
      names(
        assigneeFilterNamesQueryOptions(browserApiClient, chosenRecordIds(filters, 'assigneeId')),
      ),
    ),
  };
  return (key: EntityFilterKey, value: string): FilterOption | undefined => {
    const lookup = lookups[key];
    if (!lookup.isSuccess) {
      return undefined;
    }
    const record = lookup.data.find((candidate) => candidate.id === value);
    if (record !== undefined) {
      return toOption(record);
    }
    // An ID the last lookup did not know may still be visible: unknown only once it is looked up.
    return lookup.isPlaceholderData ? undefined : { value, label: tf('unknown') };
  };
}
