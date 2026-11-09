'use client';

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@trybun/ui/components/drawer';
import { Field, FieldLabel, FieldTitle } from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { RadioGroup, RadioGroupItem } from '@trybun/ui/components/radio-group';
import { Fragment, type ReactNode } from 'react';

/** A choice of a field picker: the value it sets and its label. */
export interface PickerOption {
  value: string;
  label: string;
}

/** Choices under a heading, e.g. the statuses of one kind (§4.1). */
export interface PickerGroup {
  label: string;
  options: PickerOption[];
}

/** The search of a picker whose choices the server finds as the person types. */
export interface PickerSearch {
  label: string;
  value: string;
  /** The longest search the server accepts. */
  maxLength?: number;
  onValueChange: (value: string) => void;
}

/**
 * The bottom sheet of a field of the ticket view on phones (§18.6, Rule 9): the field's choices as
 * large radio cards, under a search when the server finds them; a choice applies at once and
 * closes the sheet, a swipe down or Escape closes it without a change. Open while it is rendered.
 */
export function FieldSheet({
  title,
  description,
  value,
  groups,
  search,
  empty,
  onValueChange,
  onClose,
}: {
  title: string;
  description?: string;
  value: string | null;
  groups: PickerGroup[];
  search?: PickerSearch;
  /** Shown when no group has a choice, e.g. no person matches the search. */
  empty?: ReactNode;
  onValueChange: (value: string) => void;
  onClose: () => void;
}) {
  const hasChoices = groups.some((group) => group.options.length > 0);
  return (
    <Drawer
      defaultOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description !== undefined && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pb-4">
          {search !== undefined && (
            <Field>
              <FieldLabel>{search.label}</FieldLabel>
              <Input
                type="search"
                value={search.value}
                maxLength={search.maxLength}
                autoComplete="off"
                onChange={(event) => search.onValueChange(event.target.value)}
              />
            </Field>
          )}
          {hasChoices ? (
            <RadioGroup
              aria-label={title}
              value={value ?? ''}
              onValueChange={(next) => {
                if (typeof next === 'string' && next !== value) {
                  onValueChange(next);
                }
                onClose();
              }}
              className="gap-2"
            >
              {groups.map((group) => (
                <Fragment key={group.label}>
                  {group.label !== '' && group.options.length > 0 && (
                    <p aria-hidden className="pt-1 text-xs font-medium text-muted-foreground">
                      {group.label}
                    </p>
                  )}
                  {group.options.map((option) => (
                    <FieldLabel key={option.value}>
                      <Field orientation="horizontal">
                        <RadioGroupItem value={option.value} />
                        <FieldTitle className="min-w-0 break-words">{option.label}</FieldTitle>
                      </Field>
                    </FieldLabel>
                  ))}
                </Fragment>
              ))}
            </RadioGroup>
          ) : (
            empty
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
