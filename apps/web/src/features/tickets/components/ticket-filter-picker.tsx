'use client';

import { LIST_SEARCH_QUERY_MAX_LENGTH } from '@trybun/contracts/pagination';
import type { TicketListFilters } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import {
  Combobox,
  ComboboxCheckboxItem,
  ComboboxList,
  ComboboxPopupInput,
  ComboboxStatus,
} from '@trybun/ui/components/combobox';
import { cn } from '@trybun/ui/lib/utils';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useEffect, useId, useRef, useState } from 'react';
import {
  OPEN_TICKET_STATUSES,
  type TicketListFilterKey,
  withFilterValues,
} from '../ticket-list.js';
import {
  chosenRecordIds,
  type EntityFilterKey,
  type FilterGroup,
  type FilterOption,
  isEntityFilterKey,
  useEntityFilterSearch,
  useFixedFilterGroups,
  useRecordOption,
} from './ticket-filter-options.js';

/** Whether an option's label contains the search, ignoring case. */
function matches(option: FilterOption, search: string) {
  return option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase());
}

/**
 * The picker of one filter (§8.1, #279): a search input over a checkbox list, rendered inline in
 * the popover or the bottom sheet of the filter bar (Base UI `inline`). The chosen values are
 * pinned on top; each toggle calls `onFiltersChange` at once and the picker stays open.
 *
 * Projects, organizations and people are searched on the server – the first page per state,
 * narrowed as the person types (deferred) – and the fixed fields filter their few options here.
 * Status has the shortcut **Open** (the non-terminal statuses); Assignee offers **Me** and
 * **Unassigned** first and its people only for the chosen projects (S1-13 Q7).
 */
export function TicketFilterPicker({
  field,
  label,
  filters,
  nameOf,
  autoFocus,
  className,
  onFiltersChange,
}: {
  field: TicketListFilterKey;
  /** The name of the field, e.g. "Project". */
  label: string;
  filters: TicketListFilters;
  /** The name of a chosen record, `undefined` while it is looked up (`useFilterValueNames`). */
  nameOf: (key: EntityFilterKey, value: string) => FilterOption | undefined;
  /**
   * Whether the search input takes the focus when the picker appears: after a press of a mouse
   * or a key, never after a touch, so the on-screen keyboard does not cover the list (Q7).
   */
  autoFocus: boolean;
  className?: string;
  onFiltersChange: (filters: TicketListFilters) => void;
}) {
  const tf = useTranslations('tickets.list.filters');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const page = useEntityFilterSearch(field, filters, deferredSearch);
  const toOption = useRecordOption();
  const fixedGroups = useFixedFilterGroups()(field, filters);
  const values: readonly string[] = filters[field] ?? [];

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const fixedValues = new Set(
    fixedGroups.flatMap((group) => group.options.map(({ value }) => value)),
  );
  // The fixed first options of an entity field (Me, Unassigned, No organization) keep their place.
  const isFirstOption = (value: string) => isEntityFilterKey(field) && fixedValues.has(value);
  const pinned: FilterOption[] = values
    .filter((value) => !isFirstOption(value))
    .flatMap((value) => {
      if (!isEntityFilterKey(field)) {
        const option = fixedGroups.flatMap((group) => group.options).find((o) => o.value === value);
        return option === undefined ? [] : [option];
      }
      const found = page?.data?.records.find((record) => record.id === value);
      const option = nameOf(field, value) ?? (found === undefined ? undefined : toOption(found));
      // A name still being looked up has no row yet; its chip can still remove it.
      return option === undefined ? [] : [option];
    });
  const isChosen = (option: FilterOption) =>
    values.includes(option.value) && !isFirstOption(option.value);
  const fixed: FilterGroup[] = fixedGroups
    .map((group) => ({
      label: group.label,
      options: group.options.filter(
        (option) => !isChosen(option) && matches(option, search.trim()),
      ),
    }))
    .filter((group) => group.options.length > 0);
  const found: FilterGroup[] =
    page?.data === undefined
      ? []
      : [
          {
            label: '',
            options: page.data.records.map(toOption).filter((option) => !isChosen(option)),
          },
        ];
  const groups = isEntityFilterKey(field) ? [...fixed, ...found] : fixed;
  const options = groups.flatMap((group) => group.options);

  const isWithoutProjects =
    field === 'assigneeId' && chosenRecordIds(filters, 'projectId').length === 0;
  const isLoading = page !== null && page.isPending && page.fetchStatus !== 'idle';
  const isEmpty =
    search.trim() !== '' && options.length === 0 && !isLoading && page?.isError !== true;
  const status = isLoading
    ? tf('loading')
    : isEmpty
      ? tf(`noMatches.${field}`, { query: search.trim() })
      : page?.data?.hasMore === true
        ? tf('typeToFindMore')
        : '';
  const isOpenChosen =
    values.length === OPEN_TICKET_STATUSES.length &&
    OPEN_TICKET_STATUSES.every((value) => values.includes(value));

  const item = (option: FilterOption) => (
    <ComboboxCheckboxItem key={option.value} value={option.value}>
      <span className="min-w-0 break-words">{option.label}</span>
    </ComboboxCheckboxItem>
  );

  return (
    <Combobox
      inline
      open
      multiple
      filter={null}
      value={values}
      inputValue={search}
      onInputValueChange={(text, details) => {
        // A press on an item may write into the input as well; only typing searches (S1-10).
        if (details.reason === 'input-change' || details.reason === 'input-clear') {
          setSearch(text);
        }
      }}
      onValueChange={(next: string[]) => onFiltersChange(withFilterValues(filters, field, next))}
    >
      <div className={cn('flex min-h-0 flex-col', className)}>
        <ComboboxPopupInput
          ref={inputRef}
          aria-label={tf(`searches.${field}`)}
          placeholder={tf(`searches.${field}`)}
          maxLength={LIST_SEARCH_QUERY_MAX_LENGTH}
          aria-describedby={isWithoutProjects ? hintId : undefined}
        />
        {field === 'status' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={isOpenChosen}
            className="m-1 w-fit"
            onClick={() =>
              onFiltersChange(withFilterValues(filters, 'status', OPEN_TICKET_STATUSES))
            }
          >
            {tf('open')}
          </Button>
        )}
        <ComboboxList aria-label={label} className="max-h-none min-h-0 flex-1">
          {pinned.map(item)}
          {groups.map((group, index) =>
            group.label === '' ? (
              group.options.map(item)
            ) : (
              <div key={group.label} role="group" aria-label={group.label}>
                <div
                  aria-hidden
                  className={cn(
                    'px-2 pb-1 text-xs font-medium text-muted-foreground',
                    (index > 0 || pinned.length > 0) && 'pt-2',
                  )}
                >
                  {group.label}
                </div>
                {group.options.map(item)}
              </div>
            ),
          )}
        </ComboboxList>
        {isWithoutProjects && (
          <p id={hintId} className="px-2 py-2 text-sm text-muted-foreground">
            {tf('chooseProjects')}
          </p>
        )}
        {page?.isError === true && (
          <div role="alert" className="flex flex-col items-center gap-2 px-2 py-3 text-sm">
            <p>{tf('loadFailed')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void page.refetch()}>
              {tf('retry')}
            </Button>
          </div>
        )}
        <ComboboxStatus>{status}</ComboboxStatus>
      </div>
    </Combobox>
  );
}
