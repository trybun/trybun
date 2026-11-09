'use client';

import { Button } from '@trybun/ui/components/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@trybun/ui/components/select';
import { TABLET_MEDIA_QUERY, useMediaQuery } from '@trybun/ui/hooks/use-media-query';
import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';
import type { PickerGroup } from './field-sheet.js';
import { LazyFieldSheet } from './lazy-field-sheet.js';

/**
 * A field of the ticket view that saves on selection (§3.2, Q10): a `Select` from the tablet
 * breakpoint on, a button that opens a bottom sheet on phones (§18.6, Rule 9). Choosing the
 * current value changes nothing. `value` is `null` while the field is not set (`placeholder`).
 */
export function FieldPicker({
  label,
  value,
  placeholder,
  groups,
  disabled = false,
  onValueChange,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  groups: PickerGroup[];
  disabled?: boolean;
  onValueChange: (value: string) => void;
}) {
  const isSheet = !useMediaQuery(TABLET_MEDIA_QUERY);
  const [isOpen, setIsOpen] = useState(false);
  const options = groups.flatMap((group) => group.options);
  const current = options.find((option) => option.value === value)?.label ?? placeholder;
  const choose = (next: string) => {
    if (next !== value) {
      onValueChange(next);
    }
  };

  if (isSheet) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          aria-label={`${label}: ${current}`}
          disabled={disabled}
          className="w-full justify-between"
          onClick={() => setIsOpen(true)}
        >
          <span className="truncate">{current}</span>
          <ChevronDownIcon aria-hidden className="text-muted-foreground" />
        </Button>
        {isOpen && (
          <LazyFieldSheet
            title={label}
            value={value}
            groups={groups}
            onValueChange={choose}
            onClose={() => setIsOpen(false)}
          />
        )}
      </>
    );
  }
  return (
    <Select
      items={options}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (typeof next === 'string') {
          choose(next);
        }
      }}
    >
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) =>
          group.label === '' ? (
            group.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))
          ) : (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ),
        )}
      </SelectContent>
    </Select>
  );
}
