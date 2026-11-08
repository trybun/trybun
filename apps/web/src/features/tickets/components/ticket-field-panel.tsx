'use client';

import {
  type Ticket,
  type TicketAction,
  ticketPrioritySchema,
  ticketTypeSchema,
  type UpdateTicketDto,
} from '@trybun/contracts/tickets';
import { toast } from '@trybun/ui/components/toast';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useUpdateTicket } from '../mutations.js';
import { FieldPicker } from './field-picker.js';

/**
 * The fields of a ticket in the team ticket view (§3.2): status with its waiting reason, assignee,
 * type ("Not set" for an end-user ticket before triage), priority, project, requester, the
 * organization only when the ticket has one (§7.3), and the times of creation and the latest
 * change in the person's time zone (§13.1). A side panel from the `lg` breakpoint, the **Details**
 * section between the header and the description below it (Rule 9).
 *
 * Type and priority (`update_fields`) save on selection, then a toast offers **Undo**, which sends
 * the inverse change with the version the change returned (Q10) – except for a type that was not
 * set, which cannot be unset again. A field without its action in `allowedActions` is text; in an
 * archived project the API allows only `read`, so every field is.
 */
export function TicketFieldPanel({ ticket }: { ticket: Ticket }) {
  const t = useTranslations('tickets');
  const format = useFormatter();
  const change = useFieldChange(ticket);
  const can = (action: TicketAction) => ticket.allowedActions.includes(action);
  const time = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });
  const pending = change.isPending ? change.variables?.input : undefined;
  const type = pending?.type ?? ticket.type;
  const priority = pending?.priority ?? ticket.priority;
  return (
    <section aria-labelledby="ticket-details" className="flex flex-col gap-3">
      <h2 id="ticket-details" className="text-lg font-semibold">
        {t('view.details')}
      </h2>
      <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-x-4 gap-y-3 text-sm lg:grid-cols-1 lg:gap-y-1">
        <Field label={t('view.fields.status')}>
          {t(`statuses.${ticket.status}`)}
          {ticket.waitingReason !== null && (
            <span className="block text-muted-foreground">
              {t(`waitingReasons.${ticket.waitingReason}`)}
            </span>
          )}
        </Field>
        <Field label={t('view.fields.assignee')}>
          {ticket.assignee === null
            ? t('view.unassigned')
            : (ticket.assignee.displayName ?? t('deletedUser'))}
        </Field>
        <Field label={t('view.fields.type')}>
          {can('update_fields') ? (
            <FieldPicker
              label={t('view.fields.type')}
              value={type}
              placeholder={t('view.notSet')}
              groups={[
                {
                  label: '',
                  options: ticketTypeSchema.options.map((value) => ({
                    value,
                    label: t(`types.${value}`),
                  })),
                },
              ]}
              disabled={change.isPending}
              onValueChange={(value) => {
                const next = ticketTypeSchema.parse(value);
                change.apply(
                  { type: next },
                  ticket.type === null ? undefined : { type: ticket.type },
                  t('view.changed.type', { type: t(`types.${next}`) }),
                );
              }}
            />
          ) : ticket.type === null ? (
            t('view.notSet')
          ) : (
            t(`types.${ticket.type}`)
          )}
        </Field>
        <Field label={t('view.fields.priority')}>
          {can('update_fields') ? (
            <FieldPicker
              label={t('view.fields.priority')}
              value={priority}
              placeholder={t('view.notSet')}
              groups={[
                {
                  label: '',
                  options: ticketPrioritySchema.options.map((value) => ({
                    value,
                    label: t(`priorities.${value}`),
                  })),
                },
              ]}
              disabled={change.isPending}
              onValueChange={(value) => {
                const next = ticketPrioritySchema.parse(value);
                change.apply(
                  { priority: next },
                  { priority: ticket.priority },
                  t('view.changed.priority', { priority: t(`priorities.${next}`) }),
                );
              }}
            />
          ) : (
            t(`priorities.${ticket.priority}`)
          )}
        </Field>
        <Field label={t('view.fields.project')}>{ticket.project.name}</Field>
        <Field label={t('view.fields.requester')}>
          {ticket.requester.displayName ?? t('deletedUser')}
        </Field>
        {ticket.organization !== null && (
          <Field label={t('view.fields.organization')}>{ticket.organization.name}</Field>
        )}
        <Field label={t('view.fields.created')}>
          <time dateTime={ticket.createdAt}>{time(ticket.createdAt)}</time>
        </Field>
        <Field label={t('view.fields.updated')}>
          <time dateTime={ticket.updatedAt}>{time(ticket.updatedAt)}</time>
        </Field>
      </dl>
    </section>
  );
}

/**
 * A change of a field that saves on selection (Q10): the toast names the change and, with an
 * `inverse`, offers **Undo**, sent with the version the change returned. Undo is a change of its
 * own with its own event; refused (`412`, `403`, `422`) it shows the message and the ticket is read
 * again (`useUpdateTicket`), and it is never retried.
 */
export function useFieldChange(ticket: Ticket) {
  const t = useTranslations('tickets');
  const errorMessage = useErrorMessage();
  const updateTicket = useUpdateTicket();
  const showError = (error: unknown) => toast.add({ title: errorMessage(error), type: 'error' });
  const apply = (input: UpdateTicketDto, inverse: UpdateTicketDto | undefined, title: string) =>
    updateTicket.mutate(
      { ticket, input },
      {
        onSuccess: (updated) =>
          toast.add({
            title,
            type: 'success',
            ...(inverse === undefined
              ? {}
              : {
                  actionProps: {
                    children: t('view.undo'),
                    onClick: () =>
                      void updateTicket
                        .mutateAsync({ ticket: updated, input: inverse })
                        .catch(showError),
                  },
                }),
          }),
        onError: showError,
      },
    );
  return { apply, isPending: updateTicket.isPending, variables: updateTicket.variables };
}

/** A field of the panel: its label and value, one row on phones, stacked in the side panel. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents lg:block lg:pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}
