'use client';

import { useQuery } from '@tanstack/react-query';
import { LIST_SEARCH_QUERY_MAX_LENGTH } from '@trybun/contracts/pagination';
import type { Ticket } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
} from '@trybun/ui/components/combobox';
import { TABLET_MEDIA_QUERY, useMediaQuery } from '@trybun/ui/hooks/use-media-query';
import { cn } from '@trybun/ui/lib/utils';
import { ChevronDownIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { QueryErrorAlert } from '../../app-shell/components/query-error-alert.js';
import { currentUserQueryOptions } from '../../users/queries.js';
import { useIsTicketChanging } from '../mutations.js';
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
  const isChanging = useIsTicketChanging(ticket.id);
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
        projectId={ticket.projectId}
        me={me}
        selected={{ value: current?.id ?? null, label: currentName }}
        disabled={isChanging}
        headingLevel={3}
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
          disabled={isChanging}
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
 * The picker of the people who can be assigned to the tickets of a project – of a ticket in the
 * view or of the full form: a `Combobox` from the tablet breakpoint on, a bottom sheet with a
 * search on phones (§18.6). The search text goes to the server as the person types, deferred while
 * they type (Q9); it stays in the component, never in the URL (§18.5). A failed read shows its
 * error with **Try again** in place of the people (#471), never "No people"; **Unassigned**, which
 * needs no read, stays.
 */
export function AssigneePicker({
  projectId,
  me,
  selected: { value: selectedId, label: currentName },
  disabled,
  headingLevel,
  onAssign,
}: {
  projectId: string;
  /** The ID of the person; **Assign to me** is offered while they can be assigned. */
  me: string | undefined;
  /** The assignee, `null` when nobody is, with the name the control shows. */
  selected: { value: string | null; label: string };
  disabled: boolean;
  /**
   * The heading level of a refused read below the input from the tablet breakpoint on, which
   * continues the page around the picker: `3` under the `h2` of the field panel, `2` in the full form. The
   * bottom sheet has its own `h2` title, so there it is always `3`.
   */
  headingLevel: 2 | 3;
  onAssign: (assigneeId: string | null, label: string) => void;
}) {
  const t = useTranslations('tickets');
  const errorMessage = useErrorMessage();
  const isSheet = !useMediaQuery(TABLET_MEDIA_QUERY);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const members = useQuery({
    ...assignableMembersQueryOptions(browserApiClient, projectId, deferredSearch),
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
  const selected = { value: selectedId ?? UNASSIGNED, label: currentName };
  const choose = (value: string) => {
    if (value === selected.value) {
      return;
    }
    const label = choices.find((choice) => choice.value === value)?.label ?? '';
    onAssign(value === UNASSIGNED ? null : value, label);
  };
  const label = t('view.fields.assignee');
  // A refusal says when to try again; **Try again** reads the people again, so it offers no
  // **Reload page**, which would close the picker (§18.5).
  const readError = (level: 2 | 3, className: string) =>
    members.isError && (
      <div className={cn('flex flex-col gap-2 text-sm', className)}>
        <QueryErrorAlert
          error={members.error}
          message={errorMessage(members.error)}
          headingLevel={level}
          offersReload={false}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => void members.refetch()}>
          {t('view.retry')}
        </Button>
      </div>
    );

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
            groups={[{ label: '', options: members.isPending ? [] : choices }]}
            search={{
              label: t('view.searchPeople'),
              value: search,
              maxLength: LIST_SEARCH_QUERY_MAX_LENGTH,
              onValueChange: setSearch,
            }}
            empty={
              <p className="text-sm text-muted-foreground">
                {members.isPending ? t('view.loadingPeople') : t('view.noPeople')}
              </p>
            }
            alert={readError(3, 'items-center px-2 py-3')}
            onValueChange={choose}
            onClose={() => setIsOpen(false)}
          />
        )}
      </>
    );
  }
  // The list of a combobox is no stop of Tab, which closes it (WAI-ARIA APG), so the error and
  // **Try again** follow the input outside it, and the list only says that the people are missing.
  return (
    <div className="flex flex-col gap-2">
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
        <ComboboxInput
          aria-label={label}
          placeholder={currentName}
          maxLength={LIST_SEARCH_QUERY_MAX_LENGTH}
        />
        <ComboboxContent>
          {/* Mounted in every state, so its text is announced; empty after an error (#303). */}
          <ComboboxEmpty>{members.isError ? '' : t('view.noPeople')}</ComboboxEmpty>
          <ComboboxList aria-label={t('view.people')}>
            {(choice: PickerOption) => (
              <ComboboxItem key={choice.value} value={choice}>
                {choice.label}
              </ComboboxItem>
            )}
          </ComboboxList>
          {/* A polite live region, filled while the read failed: the rest of the page may be
              hidden from assistive technologies while the list is open. */}
          <ComboboxStatus>{members.isError ? t('view.peopleLoadFailed') : ''}</ComboboxStatus>
        </ComboboxContent>
      </Combobox>
      {readError(headingLevel, 'items-start')}
    </div>
  );
}
