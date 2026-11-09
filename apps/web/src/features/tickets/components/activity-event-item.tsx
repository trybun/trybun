'use client';

import type { ActivityEventResponse, ActivityEventValue } from '@trybun/contracts/activity-events';
import {
  ticketIdentifier,
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketTypeSchema,
  ticketVisibilitySchema,
  ticketWaitingReasonSchema,
} from '@trybun/contracts/tickets';
import { useFormatter, useTranslations } from 'next-intl';

/** The name of a person or a file in a snapshot (§4.5); `null` when the person was anonymized. */
function snapshotNameOf(value: ActivityEventValue | undefined): string | null | undefined {
  return typeof value === 'object' && value !== null && 'displayName' in value
    ? value.displayName
    : undefined;
}

/** A text value of an event, e.g. a title. */
function textOf(value: ActivityEventValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

/** The identifier of a ticket in a snapshot (§4.5), e.g. the original of a duplicate. */
function ticketSnapshotOf(value: unknown): string | undefined {
  return typeof value === 'object' && value !== null && 'projectKey' in value && 'number' in value
    ? ticketIdentifier(String(value.projectKey), Number(value.number))
    : undefined;
}

/**
 * One event of the team's activity timeline (§4.5): its catalogue text with the person – "System"
 * for an automatic change, "Deleted user" for an anonymized actor – the codes with their labels in
 * the reader's language, the references with the snapshot names of the event, and its time.
 */
export function ActivityEventItem({ event }: { event: ActivityEventResponse }) {
  const format = useFormatter();
  const text = useEventText(event);
  return (
    <li className="flex flex-col">
      <span className="break-words">{text}</span>
      <time dateTime={event.createdAt} className="text-sm text-muted-foreground">
        {format.dateTime(new Date(event.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
      </time>
    </li>
  );
}

function useEventText(event: ActivityEventResponse): string {
  const t = useTranslations('tickets');
  const person =
    event.actor === null ? t('timeline.system') : (event.actor.displayName ?? t('deletedUser'));
  const data = event.data;
  const name = (value: ActivityEventValue | undefined) => snapshotNameOf(value) ?? t('deletedUser');
  const status = (value: unknown) => {
    const parsed = ticketStatusSchema.safeParse(value);
    return parsed.success ? t(`statuses.${parsed.data}`) : String(value);
  };
  const type = (value: unknown) => {
    const parsed = ticketTypeSchema.safeParse(value);
    return parsed.success ? t(`types.${parsed.data}`) : t('view.notSet');
  };
  const priority = (value: unknown) => {
    const parsed = ticketPrioritySchema.safeParse(value);
    return parsed.success ? t(`priorities.${parsed.data}`) : String(value);
  };
  const visibility = (value: unknown) => {
    const parsed = ticketVisibilitySchema.safeParse(value);
    return parsed.success ? t(`visibilities.${parsed.data}`) : String(value);
  };
  const original = (value: unknown) => ticketSnapshotOf(value) ?? '';
  switch (event.type) {
    case 'title_changed':
      return t('timeline.events.titleChanged', {
        person,
        from: textOf(data?.from),
        to: textOf(data?.to),
      });
    case 'description_edited':
      return t('timeline.events.descriptionEdited', { person });
    case 'type_changed':
      return t('timeline.events.typeChanged', {
        person,
        from: type(data?.from),
        to: type(data?.to),
      });
    case 'priority_changed':
      return t('timeline.events.priorityChanged', {
        person,
        from: priority(data?.from),
        to: priority(data?.to),
      });
    case 'assignee_changed':
      if (data?.from == null) {
        return t('timeline.events.assigneeSet', { person, assignee: name(data?.to) });
      }
      if (data.to === null) {
        return t('timeline.events.assigneeRemoved', { person, assignee: name(data.from) });
      }
      return t('timeline.events.assigneeChanged', {
        person,
        from: name(data.from),
        to: name(data.to),
      });
    case 'status_changed':
      return statusText();
    case 'duplicate_original_changed':
      return t('timeline.events.duplicateOriginalChanged', {
        person,
        from: original(data?.from),
        to: original(data?.to),
      });
    case 'duplicate_link_removed':
      return t('timeline.events.duplicateLinkRemoved', { person, original: original(data?.from) });
    case 'rejection_reason_changed':
      return t('timeline.events.rejectionReasonChanged', { person });
    case 'attachment_added':
      return t('timeline.events.attachmentAdded', { person, file: name(data?.to) });
    case 'attachment_deleted':
      return t('timeline.events.attachmentDeleted', { person, file: name(data?.from) });
    case 'visibility_changed':
      return t('timeline.events.visibilityChanged', {
        person,
        from: visibility(data?.from),
        to: visibility(data?.to),
      });
    case 'sharing_requested':
      return t('timeline.events.sharingRequested', { person });
    case 'sharing_request_withdrawn':
      return t('timeline.events.sharingRequestWithdrawn', { person });
    case 'sharing_approved':
      return t('timeline.events.sharingApproved', { person });
    case 'sharing_rejected':
      return t('timeline.events.sharingRejected', { person });
  }

  /**
   * A status change (S1-06): a duplicate names its original, a reopen says so, a wait names its
   * reason, and a new reason of an unchanged wait is a change of the reason only.
   */
  function statusText(): string {
    const from = data?.from;
    const to = data?.to;
    const reason = ticketWaitingReasonSchema.safeParse(
      data !== null && 'waitingReason' in data ? data.waitingReason : undefined,
    );
    const duplicateOf = data !== null && 'duplicateOf' in data ? data.duplicateOf : undefined;
    const isReopen = data !== null && 'reopen' in data && data.reopen === true;
    if (duplicateOf != null) {
      return t('timeline.events.markedDuplicate', { person, original: original(duplicateOf) });
    }
    if (from === to && reason.success) {
      return t('timeline.events.waitingReasonChanged', {
        person,
        reason: t(`waitingReasons.${reason.data}`),
      });
    }
    const values = { person, from: status(from), to: status(to) };
    if (reason.success) {
      const withReason = { ...values, reason: t(`waitingReasons.${reason.data}`) };
      return isReopen
        ? t('timeline.events.reopenedWaiting', withReason)
        : t('timeline.events.statusChangedWaiting', withReason);
    }
    return isReopen
      ? t('timeline.events.reopened', values)
      : t('timeline.events.statusChanged', values);
  }
}
