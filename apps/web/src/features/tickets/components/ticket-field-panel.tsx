'use client';

import {
  type Ticket,
  type TicketAction,
  ticketPrioritySchema,
  ticketTypeSchema,
} from '@trybun/contracts/tickets';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { AssigneeControl } from './assignee-control.js';
import { FieldPicker } from './field-picker.js';
import { StatusControl } from './status-control.js';
import { useFieldChange } from './use-field-change.js';

/**
 * The fields of a ticket in the team ticket view (§3.2): status with its waiting reason, assignee,
 * type ("Not set" for an end-user ticket before triage), priority, project, requester, the
 * organization only when the ticket has one (§7.3), and the times of creation and the latest
 * change in the person's time zone (§13.1). A side panel from the `lg` breakpoint, the **Details**
 * section between the header and the description below it (Rule 9).
 *
 * The status follows `change_status` (`StatusControl`), the assignee `assign` / `assign_self`
 * (`AssigneeControl`). Type and priority
 * (`update_fields`) save on selection, then a toast offers **Undo**, which sends
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
          <StatusControl ticket={ticket} />
        </Field>
        <Field label={t('view.fields.assignee')}>
          <AssigneeControl ticket={ticket} />
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

/** A field of the panel: its label and value, one row on phones, stacked in the side panel. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents lg:block lg:pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}
