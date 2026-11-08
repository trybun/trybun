'use client';

import { useQuery } from '@tanstack/react-query';
import type { Ticket } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@trybun/ui/components/combobox';
import { TABLET_MEDIA_QUERY, useMediaQuery } from '@trybun/ui/hooks/use-media-query';
import { ChevronDownIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { currentUserQueryOptions } from '../../users/queries.js';
import { assignableMembersQueryOptions } from '../queries.js';
import type { PickerOption } from './field-sheet.js';
import { LazyFieldSheet } from './lazy-field-sheet.js';
import { useFieldChange } from './use-field-change.js';

/** The value of the choice **Unassigned**; a user ID is a UUID, so it never collides. */
const UNASSIGNED = 'unassigned';

/**
 * The assignee of a ticket in the field panel (§7.5, S1-10 "Assignment"). With `assign` a picker
 * searched on the server – **Assign to me** first while the person can be assigned in the project
 * (an Administrator outside it cannot), **Unassigned** last; with only `assign_self` **Assign to
 * me** (also taking over a ticket assigned to someone else) or **Unassign me**, no picker;
 * otherwise the assignee as text. Every change saves at once with **Undo**, except a take-over
 * with only `assign_self`: its inverse would assign another person, which `assign_self` does not
 * allow (Q10). The server still checks every assignment.
 */
export function AssigneeControl({ ticket }: { ticket: Ticket }) {
  const t = useTranslations('tickets');
  const user = useQuery(currentUserQueryOptions(browserApiClient));
  const change = useFieldChange(ticket);
  const me = user.data?.id;
  const current = ticket.assignee;
  const name = (person: { displayName: string | null }) => person.displayName ?? t('deletedUser');
  const currentName = current === null ? t('view.unassigned') : name(current);

  const assign = (assigneeId: string | null, label: string, withUndo = true) =>
    change.apply(
      { assigneeId },
      withUndo ? { assigneeId: current?.id ?? null } : undefined,
      assigneeId === null
        ? t('view.changed.unassigned')
        : assigneeId === me
          ? t('view.changed.assignedToMe')
          : t('view.changed.assigned', { name: label }),
    );

  if (ticket.allowedActions.includes('assign')) {
    return (
      <AssigneePicker
        ticket={ticket}
        me={me}
        currentName={currentName}
        disabled={change.isPending}
        onAssign={(assigneeId, label) => assign(assigneeId, label)}
      />
    );
  }
  if (ticket.allowedActions.includes('assign_self') && me !== undefined) {
    const isMine = current?.id === me;
    return (
      <div className="flex flex-col items-start gap-2">
        <span>{currentName}</span>
        <Button
          type="button"
          variant="outline"
          className="w-full lg:w-fit"
          disabled={change.isPending}
          onClick={() =>
            isMine
              ? assign(null, '')
              : // Taking over from someone else has no Undo; an unassigned ticket's has.
                assign(me, '', current === null)
          }
        >
          {isMine ? t('view.unassignMe') : t('view.assignToMe')}
        </Button>
      </div>
    );
  }
  return currentName;
}

/**
 * The picker of the people who can be assigned: a `Combobox` from the tablet breakpoint on, a
 * bottom sheet with a search on phones (§18.6). The search text goes to the server as the person
 * types, deferred while they type (Q9); it stays in the component, never in the URL (§18.5).
 */
function AssigneePicker({
  ticket,
  me,
  currentName,
  disabled,
  onAssign,
}: {
  ticket: Ticket;
  me: string | undefined;
  currentName: string;
  disabled: boolean;
  onAssign: (assigneeId: string | null, label: string) => void;
}) {
  const t = useTranslations('tickets');
  const isSheet = !useMediaQuery(TABLET_MEDIA_QUERY);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const members = useQuery({
    ...assignableMembersQueryOptions(browserApiClient, ticket.projectId, deferredSearch),
    enabled: isOpen,
  });
  const people = members.data?.items.map(({ user }) => user) ?? [];
  const isAssignable = people.some((person) => person.id === me);
  const choices: PickerOption[] = [
    ...(isAssignable && me !== undefined ? [{ value: me, label: t('view.assignToMe') }] : []),
    ...people
      .filter((person) => person.id !== me)
      .map((person) => ({
        value: person.id,
        label:
          person.displayName ??
          (person.githubLogin === null ? t('deletedUser') : `@${person.githubLogin}`),
      })),
    { value: UNASSIGNED, label: t('view.unassigned') },
  ];
  const selected = { value: ticket.assignee?.id ?? UNASSIGNED, label: currentName };
  const choose = (value: string) => {
    if (value === selected.value) {
      return;
    }
    const label = choices.find((choice) => choice.value === value)?.label ?? '';
    onAssign(value === UNASSIGNED ? null : value, label);
  };
  const label = t('view.fields.assignee');

  if (isSheet) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          aria-label={`${label}: ${currentName}`}
          disabled={disabled}
          className="w-full justify-between"
          onClick={() => {
            setSearch('');
            setIsOpen(true);
          }}
        >
          <span className="truncate">{currentName}</span>
          <ChevronDownIcon aria-hidden className="text-muted-foreground" />
        </Button>
        {isOpen && (
          <LazyFieldSheet
            title={label}
            value={selected.value}
            groups={[{ label: '', options: members.isSuccess ? choices : [] }]}
            search={{ label: t('view.searchPeople'), value: search, onValueChange: setSearch }}
            empty={
              <p className="text-sm text-muted-foreground">
                {members.isPending ? t('view.loadingPeople') : t('view.noPeople')}
              </p>
            }
            onValueChange={choose}
            onClose={() => setIsOpen(false)}
          />
        )}
      </>
    );
  }
  return (
    <Combobox
      items={choices}
      value={selected}
      filter={null}
      disabled={disabled}
      isItemEqualToValue={(item, value) => item.value === value.value}
      // The input shows the assignee while the list is closed and the search while it is open,
      // which starts empty, so the list starts with everyone.
      inputValue={isOpen ? search : currentName}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setSearch('');
        }
      }}
      onInputValueChange={(text, details) => {
        // Choosing a person writes their name into the input; only typing searches.
        if (details.reason === 'input-change' || details.reason === 'input-clear') {
          setSearch(text);
        }
      }}
      onValueChange={(choice) => {
        // Clearing the input sets no value (#161): only a choice changes the assignee.
        if (choice !== null) {
          choose(choice.value);
        }
      }}
    >
      <ComboboxInput aria-label={label} placeholder={currentName} />
      <ComboboxContent>
        <ComboboxEmpty>{t('view.noPeople')}</ComboboxEmpty>
        <ComboboxList aria-label={t('view.people')}>
          {(choice: PickerOption) => (
            <ComboboxItem key={choice.value} value={choice}>
              {choice.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
