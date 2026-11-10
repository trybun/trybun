'use client';

import {
  sortOrderSchema,
  type TicketListFilters,
  ticketListSortSchema,
} from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@trybun/ui/components/drawer';
import {
  Popover,
  PopoverContent,
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
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import {
  TICKET_LIST_FILTER_KEYS,
  type TicketListFilterKey,
  type TicketListSorting,
  withFilterValues,
} from '../ticket-list.js';
import { LazyTicketFilterPicker } from './lazy-ticket-filter-picker.js';
import {
  type FilterOption,
  isEntityFilterKey,
  useFilterFields,
  useFilterValueNames,
  useFixedFilterGroups,
} from './ticket-filter-options.js';

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

/** What the open popover or bottom sheet shows: the field list, or the picker of one field. */
type Step = TicketListFilterKey | null;

/**
 * The filter bar of the list (§8.1, #279): **Add filter** opens the list of the fields not yet
 * active, a field opens its picker in place, and every active filter is a chip whose name reopens
 * its picker and whose **×** removes it. From the tablet width on it is a popover, on phones one
 * bottom sheet with the field list and the picker as two steps (§18.6). Every change applies at
 * once. A value of a record the person cannot see shows "Unknown" (S1-13 Q5).
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
  const fields = useFilterFields(filters, organizationsExist);
  const nameOf = useFilterValueNames(filters);
  const fixedGroupsOf = useFixedFilterGroups();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>(null);
  const [opener, setOpener] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  // How the last press was made – events of the portalled popup bubble here too: a touch keeps
  // the focus off the search input (Q7).
  const lastPress = useRef<string>('mouse');
  const popupRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const triggerId = (key: Step) => `${id}-${key ?? 'add'}`;

  const labelOf = (key: TicketListFilterKey) =>
    fields.find((field) => field.key === key)?.label ?? t(`names.${key}`);
  const active = TICKET_LIST_FILTER_KEYS.filter((key) => (filters[key]?.length ?? 0) > 0);
  // A chip whose last value was unticked stays while its picker is open: the picker is anchored
  // to it and returns the focus to it.
  const chips = TICKET_LIST_FILTER_KEYS.filter(
    (key) => active.includes(key) || (isOpen && opener === triggerId(key)),
  );
  const available = fields.filter((field) => !active.includes(field.key));

  const optionOf = (key: TicketListFilterKey, value: string): FilterOption | undefined => {
    const fixed = fixedGroupsOf(key, filters)
      .flatMap((group) => group.options)
      .find((option) => option.value === value);
    return fixed ?? (isEntityFilterKey(key) ? nameOf(key, value) : undefined);
  };
  /** "QM150 +2": the first chosen name and the count of the rest; the count while names load. */
  const valuesOf = (key: TicketListFilterKey) => {
    const values = filters[key] ?? [];
    const [value] = values;
    if (value === undefined) {
      return '';
    }
    const first = optionOf(key, value);
    if (first === undefined) {
      return String(values.length);
    }
    const name = first.short ?? first.label;
    return values.length === 1 ? name : t('values', { first: name, count: values.length - 1 });
  };
  const chipName = (key: TicketListFilterKey) => {
    const values = valuesOf(key);
    return values === '' ? labelOf(key) : t('chip', { filter: labelOf(key), values });
  };

  const notePress = {
    onPointerDownCapture: (event: { pointerType: string }) => {
      lastPress.current = event.pointerType;
    },
    onKeyDownCapture: () => {
      lastPress.current = 'keyboard';
    },
  };
  /** Shows a step; a picker's input takes the focus unless the press was a touch (Q7). */
  const show = (next: Step) => {
    const isTouch = lastPress.current === 'touch';
    setIsInputFocused(next !== null && !isTouch);
    setStep(next);
    if (isTouch) {
      // The pressed row leaves the DOM: the popup keeps the focus, the keyboard stays down.
      popupRef.current?.focus();
    }
  };
  const openFrom = (key: Step) => () => {
    setOpener(triggerId(key));
    show(key);
  };
  const remove = (key: TicketListFilterKey) => onFiltersChange(withFilterValues(filters, key, []));

  const fieldList = (
    <ul className="flex flex-col" aria-label={t('fields')}>
      {available.map((field) => (
        <li key={field.key}>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-between"
            onClick={() => show(field.key)}
          >
            {field.label}
            <ChevronRightIcon aria-hidden data-icon="inline-end" />
          </Button>
        </li>
      ))}
    </ul>
  );
  const picker = (key: TicketListFilterKey, className?: string) => (
    <LazyTicketFilterPicker
      key={key}
      field={key}
      label={labelOf(key)}
      filters={filters}
      nameOf={nameOf}
      autoFocus={isInputFocused}
      className={className}
      onFiltersChange={onFiltersChange}
    />
  );
  // A touch opens on the popup, so the on-screen keyboard stays down; a mouse or a key opens on
  // the field list's first row, or – for a picker – on its input, which the picker focuses (Q7).
  const initialFocus = (openType: string) => {
    if (openType === 'touch' || lastPress.current === 'touch') {
      return popupRef.current ?? true;
    }
    return step === null;
  };
  // The focus returns to the chip or button that opened it – to Add filter once that chip is gone.
  const finalFocus = () =>
    document.getElementById(opener ?? '') ?? document.getElementById(triggerId(null));

  // The triggers of the popover or the sheet: Add filter and every chip's name (Base UI).
  const bar = (trigger: typeof PopoverTrigger | typeof DrawerTrigger) => {
    const Trigger = trigger;
    return (
      <>
        <Trigger
          id={triggerId(null)}
          render={<Button type="button" variant="outline" />}
          onClick={openFrom(null)}
        >
          <PlusIcon aria-hidden data-icon="inline-start" />
          {t('add')}
        </Trigger>
        {chips.map((key) => {
          const name = chipName(key);
          return (
            <div
              key={key}
              data-slot="button-group"
              className="flex max-w-full items-center rounded-lg bg-secondary"
            >
              <Trigger
                id={triggerId(key)}
                render={<Button type="button" variant="secondary" size="sm" />}
                aria-label={t('change', { filter: labelOf(key), values: valuesOf(key) })}
                className="min-w-0 pr-1"
                onClick={openFrom(key)}
              >
                <span className="truncate">{name}</span>
              </Trigger>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label={t('remove', { filter: labelOf(key), values: valuesOf(key) })}
                onClick={() => remove(key)}
              >
                <XIcon aria-hidden />
              </Button>
            </div>
          );
        })}
        {active.length > 0 && (
          <Button type="button" variant="link" onClick={() => onFiltersChange({})}>
            {t('clear')}
          </Button>
        )}
      </>
    );
  };

  return (
    <div
      data-tour="ticket-list-filter"
      className="flex flex-wrap items-center gap-2"
      {...notePress}
    >
      {isSheet ? (
        <Drawer open={isOpen} triggerId={opener} onOpenChange={setIsOpen}>
          {bar(DrawerTrigger)}
          <DrawerContent ref={popupRef} initialFocus={initialFocus} finalFocus={finalFocus}>
            <DrawerHeader className="flex-row items-center gap-1 text-left">
              {step !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t('back')}
                  onClick={() => show(null)}
                >
                  <ChevronLeftIcon aria-hidden data-icon="inline-start" />
                  {t('fields')}
                </Button>
              )}
              <DrawerTitle className="min-w-0 flex-1 truncate">
                {step === null ? t('title') : labelOf(step)}
              </DrawerTitle>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col px-4 py-2">
              {step === null ? fieldList : picker(step, 'min-h-0 flex-1')}
            </div>
            <DrawerFooter className="pt-2">
              <DrawerClose render={<Button type="button" />}>{t('done')}</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Popover open={isOpen} triggerId={opener} onOpenChange={setIsOpen}>
          {bar(PopoverTrigger)}
          <PopoverContent
            ref={popupRef}
            align="start"
            initialFocus={initialFocus}
            finalFocus={finalFocus}
            className="max-h-(--available-height) w-80 p-1"
          >
            <PopoverTitle className="sr-only">
              {step === null ? t('title') : labelOf(step)}
            </PopoverTitle>
            {step === null ? fieldList : picker(step, 'max-h-96')}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
