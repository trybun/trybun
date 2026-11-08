'use client';

import type { Ticket } from '@trybun/contracts/tickets';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

/**
 * The fields of a ticket in the team ticket view (§3.2): status with its waiting reason, assignee,
 * type ("Not set" for an end-user ticket before triage), priority, project, requester, the
 * organization only when the ticket has one (§7.3), and the times of creation and the latest
 * change in the person's time zone (§13.1). A side panel from the `lg` breakpoint, the **Details**
 * section between the header and the description below it (Rule 9).
 */
export function TicketFieldPanel({ ticket }: { ticket: Ticket }) {
  const t = useTranslations('tickets');
  const format = useFormatter();
  const time = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <section aria-labelledby="ticket-details" className="flex flex-col gap-3">
      <h2 id="ticket-details" className="text-lg font-semibold">
        {t('view.details')}
      </h2>
      <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm lg:grid-cols-1 lg:gap-y-1">
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
          {ticket.type === null ? t('view.notSet') : t(`types.${ticket.type}`)}
        </Field>
        <Field label={t('view.fields.priority')}>{t(`priorities.${ticket.priority}`)}</Field>
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
