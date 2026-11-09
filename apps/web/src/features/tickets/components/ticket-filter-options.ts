'use client';

import { useQuery } from '@tanstack/react-query';
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
  assigneeFilterOptionsQueryOptions,
  organizationFilterOptionsQueryOptions,
  projectFilterOptionsQueryOptions,
} from '../queries.js';
import type { TicketListFilterKey } from '../ticket-list.js';
import { STATUS_KINDS } from './status-control.js';

/** A value of a filter with its label. */
export interface FilterOption {
  value: string;
  label: string;
}

/** A filter's options, in groups (the statuses by kind); a group without label is plain. */
export interface FilterSection {
  key: TicketListFilterKey;
  label: string;
  groups: { label: string; options: FilterOption[] }[];
}

/**
 * The sections of the filter panel and the labels of the chips (§8.1, S1-13): fixed values from
 * the catalogues, the person's projects, the organizations while any exists (§7.3, Q6) and the
 * people of the chosen projects (Q7). A value whose record the person cannot see has no option;
 * its chip says "Unknown" (Q5).
 */
export function useTicketFilterSections(
  filters: TicketListFilters,
  organizationsExist: boolean,
): FilterSection[] {
  const t = useTranslations('tickets');
  const tf = useTranslations('tickets.list.filters');
  const projects = useQuery(projectFilterOptionsQueryOptions(browserApiClient));
  const organizations = useQuery({
    ...organizationFilterOptionsQueryOptions(browserApiClient),
    enabled: organizationsExist,
  });
  const people = useQuery(
    assigneeFilterOptionsQueryOptions(browserApiClient, filters.projectId ?? []),
  );
  const plain = (options: FilterOption[]) => [{ label: '', options }];
  const toOptions = (items: { id: string; label: string | null }[] | undefined) =>
    (items ?? []).map(({ id, label }) => ({ value: id, label: label ?? t('deletedUser') }));
  const sources = ticketSourceSchema.options.filter(
    (source) => source !== 'integration' || filters.source?.includes('integration') === true,
  );
  const sections: FilterSection[] = [
    { key: 'projectId', label: tf('names.projectId'), groups: plain(toOptions(projects.data)) },
    {
      key: 'organizationId',
      label: tf('names.organizationId'),
      groups: plain([
        ...toOptions(organizations.data),
        { value: TICKET_FILTER_NONE, label: tf('noOrganization') },
      ]),
    },
    {
      key: 'type',
      label: tf('names.type'),
      groups: plain([
        ...ticketTypeSchema.options.map((type) => ({ value: type, label: t(`types.${type}`) })),
        { value: TICKET_FILTER_NONE, label: tf('none') },
      ]),
    },
    {
      key: 'status',
      label: tf('names.status'),
      groups: STATUS_KINDS.map(({ kind, statuses }) => ({
        label: t(`status.kinds.${kind}`),
        options: statuses.map((status) => ({ value: status, label: t(`statuses.${status}`) })),
      })),
    },
    {
      key: 'priority',
      label: tf('names.priority'),
      groups: plain(
        ticketPrioritySchema.options.map((priority) => ({
          value: priority,
          label: t(`priorities.${priority}`),
        })),
      ),
    },
    {
      key: 'assigneeId',
      label: tf('names.assigneeId'),
      groups: [
        {
          label: '',
          options: [
            { value: TICKET_FILTER_ME, label: tf('me') },
            { value: TICKET_FILTER_NONE, label: tf('unassigned') },
          ],
        },
        { label: t('view.people'), options: toOptions(people.data) },
      ],
    },
    {
      key: 'source',
      label: tf('names.source'),
      groups: plain(sources.map((source) => ({ value: source, label: t(`sources.${source}`) }))),
    },
    {
      key: 'sharingRequest',
      label: tf('names.sharingRequest'),
      groups: plain(
        ticketSharingRequestFilterSchema.options.map((value) => ({
          value,
          label: tf(`sharingRequests.${value}`),
        })),
      ),
    },
  ];
  return sections.filter((section) => section.key !== 'organizationId' || organizationsExist);
}

/** The label of a value of a filter, or "Unknown" for a record the person cannot see (Q5). */
export function useFilterValueLabel(sections: FilterSection[]) {
  const tf = useTranslations('tickets.list.filters');
  return (key: TicketListFilterKey, value: string) =>
    sections
      .find((section) => section.key === key)
      ?.groups.flatMap((group) => group.options)
      .find((option) => option.value === value)?.label ?? tf('unknown');
}
