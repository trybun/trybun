'use client';

import {
  sortOrderSchema,
  type TicketListFilters,
  ticketListSortSchema,
} from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@trybun/ui/components/drawer';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@trybun/ui/components/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@trybun/ui/components/select';
import { TABLET_MEDIA_QUERY, useMediaQuery } from '@trybun/ui/hooks/use-media-query';
import { FilterIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  TICKET_LIST_FILTER_KEYS,
  type TicketListFilterKey,
  type TicketListSorting,
} from '../ticket-list.js';
import { LazyTicketFilterPanel } from './lazy-ticket-filter-panel.js';
import { useFilterValueLabel, useTicketFilterSections } from './ticket-filter-options.js';

/** The sorts of the phone's Sort select: every key in both directions (Q8). */
const SORT_OPTIONS = ticketListSortSchema.options.flatMap((sort) =>
  sortOrderSchema.options.map((order) => `${sort}-${order}` as const),
);

/** The Sort select of phones, where the table's column headers are not shown (§2.9). */
export function TicketSortSelect({
  sorting,
  onSortingChange,
}: {
  sorting: TicketListSorting;
  onSortingChange: (sorting: TicketListSorting) => void;
}) {
  const t = useTranslations('tickets.list.sort');
  const items = SORT_OPTIONS.map((value) => ({ value, label: t(`options.${value}`) }));
  return (
    <Select
      items={items}
      value={`${sorting.sort}-${sorting.order}`}
      onValueChange={(next) => {
        if (typeof next === 'string') {
          const [sort, order] = next.split('-');
          onSortingChange({
            sort: ticketListSortSchema.parse(sort),
            order: sortOrderSchema.parse(order),
          });
        }
      }}
    >
      <SelectTrigger aria-label={t('label')} className="w-full md:hidden">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The filter bar of the list (§8.1, S1-13): **Filter** opens the panel – a popover from the tablet
 * width on, a bottom sheet on phones (§18.6) – and each active filter is a removable chip. A value
 * of a record the person cannot see shows "Unknown" (Q5).
 */
export function TicketFilterBar({
  filters,
  organizationsExist,
  onFiltersChange,
}: {
  filters: TicketListFilters;
  organizationsExist: boolean;
  onFiltersChange: (filters: TicketListFilters) => void;
}) {
  const t = useTranslations('tickets.list.filters');
  const isSheet = !useMediaQuery(TABLET_MEDIA_QUERY);
  const [isOpen, setIsOpen] = useState(false);
  const sections = useTicketFilterSections(filters, organizationsExist);
  const labelOf = useFilterValueLabel(sections);
  const active = TICKET_LIST_FILTER_KEYS.filter((key) => (filters[key]?.length ?? 0) > 0);
  const apply = (next: TicketListFilters) => {
    setIsOpen(false);
    onFiltersChange(next);
  };
  const remove = (key: TicketListFilterKey) =>
    onFiltersChange(
      Object.fromEntries(Object.entries(filters).filter(([current]) => current !== key)),
    );
  const panel = isOpen && (
    <LazyTicketFilterPanel sections={sections} filters={filters} onApply={apply} />
  );
  const trigger = (
    <>
      <FilterIcon aria-hidden data-icon="inline-start" />
      {t('filter')}
    </>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isSheet ? (
        <>
          <Button
            type="button"
            variant="outline"
            aria-haspopup="dialog"
            onClick={() => setIsOpen(true)}
          >
            {trigger}
          </Button>
          {isOpen && (
            <Drawer defaultOpen onOpenChange={(open) => setIsOpen(open)}>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>{t('title')}</DrawerTitle>
                </DrawerHeader>
                <div className="flex min-h-0 flex-col px-4 pb-4">{panel}</div>
              </DrawerContent>
            </Drawer>
          )}
        </>
      ) : (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger render={<Button type="button" variant="outline" />}>
            {trigger}
          </PopoverTrigger>
          <PopoverContent align="start" className="flex max-h-(--available-height) w-96 flex-col">
            <PopoverHeader>
              <PopoverTitle>{t('title')}</PopoverTitle>
            </PopoverHeader>
            {panel}
          </PopoverContent>
        </Popover>
      )}
      {active.map((key) => {
        const name = sections.find((section) => section.key === key)?.label ?? key;
        const values = (filters[key] as string[]).map((value) => labelOf(key, value)).join(', ');
        return (
          <Button
            key={key}
            type="button"
            variant="secondary"
            size="sm"
            aria-label={t('remove', { filter: name, values })}
            className="max-w-full"
            onClick={() => remove(key)}
          >
            <span className="truncate">{t('chip', { filter: name, values })}</span>
            <XIcon aria-hidden data-icon="inline-end" />
          </Button>
        );
      })}
      {active.length > 0 && (
        <Button type="button" variant="link" onClick={() => onFiltersChange({})}>
          {t('clear')}
        </Button>
      )}
    </div>
  );
}
