'use client';

import type { TicketListFilters } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import { Checkbox } from '@trybun/ui/components/checkbox';
import { Field, FieldLabel, FieldTitle } from '@trybun/ui/components/field';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { OPEN_TICKET_STATUSES, type TicketListFilterKey } from '../ticket-list.js';
import type { FilterSection } from './ticket-filter-options.js';

/** The filters with one value toggled; a filter without values is removed. */
function toggled(
  filters: TicketListFilters,
  key: TicketListFilterKey,
  value: string,
  isOn: boolean,
): TicketListFilters {
  const values: readonly string[] = filters[key] ?? [];
  const next = isOn ? [...values, value] : values.filter((current) => current !== value);
  const rest = Object.fromEntries(
    Object.entries(filters).filter(([current]) => current !== key),
  ) as TicketListFilters;
  return next.length === 0 ? rest : { ...rest, [key]: next };
}

/**
 * The sections of the filter panel (§8.1): one per filter, each value a checkbox; the status
 * has the shortcut **Open** for the six non-terminal statuses. The filters apply with **Show
 * tickets**, so the list is read once per change, not once per checkbox.
 */
export function TicketFilterPanel({
  sections,
  filters,
  onApply,
}: {
  sections: FilterSection[];
  filters: TicketListFilters;
  onApply: (filters: TicketListFilters) => void;
}) {
  const t = useTranslations('tickets.list.filters');
  const [draft, setDraft] = useState(filters);
  const isOpenSelected =
    draft.status?.length === OPEN_TICKET_STATUSES.length &&
    OPEN_TICKET_STATUSES.every((status) => draft.status?.includes(status) === true);
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        {sections.map((section) => (
          <fieldset key={section.key} className="flex flex-col gap-1">
            <legend className="pb-1 text-sm font-medium">{section.label}</legend>
            {section.key === 'status' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={isOpenSelected}
                className="w-fit"
                onClick={() =>
                  setDraft((current) => ({ ...current, status: [...OPEN_TICKET_STATUSES] }))
                }
              >
                {t('open')}
              </Button>
            )}
            {section.groups.map((group) => (
              <div key={group.label} className="flex flex-col">
                {group.label !== '' && group.options.length > 0 && (
                  <p aria-hidden className="pt-1 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </p>
                )}
                {section.key === 'assigneeId' &&
                  group.label !== '' &&
                  (draft.projectId === undefined || draft.projectId.length === 0) && (
                    <p className="text-xs text-muted-foreground">{t('chooseProjects')}</p>
                  )}
                {group.options.map((option) => {
                  const isChecked = (draft[section.key] ?? ([] as readonly string[])).includes(
                    option.value,
                  );
                  return (
                    <FieldLabel key={option.value}>
                      <Field orientation="horizontal" className="min-h-11 items-center">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) =>
                            setDraft((current) =>
                              toggled(current, section.key, option.value, checked),
                            )
                          }
                        />
                        <FieldTitle className="min-w-0 font-normal break-words">
                          {option.label}
                        </FieldTitle>
                      </Field>
                    </FieldLabel>
                  );
                })}
              </div>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
        <Button type="button" variant="outline" onClick={() => setDraft({})}>
          {t('clear')}
        </Button>
        <Button type="button" onClick={() => onApply(draft)}>
          {t('apply')}
        </Button>
      </div>
    </div>
  );
}
