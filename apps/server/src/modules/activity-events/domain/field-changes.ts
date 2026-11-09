import type {
  ActivityEventData,
  ActivityEventSnapshot,
  ActivityEventType,
} from '@trybun/contracts/activity-events';

/**
 * The fields of a ticket whose changes the activity history records (§4.5), as one before/after
 * pair: enum codes and texts as they are, a reference as the snapshot of its name at the time of
 * the change.
 */
export interface TrackedTicketFields {
  title: string;
  description: string;
  type: string | null;
  priority: string;
  assignee: ActivityEventSnapshot | null;
}

/** One event to write: its type and the previous and new value, none for a description edit. */
export interface FieldChange {
  type: ActivityEventType;
  data: ActivityEventData | null;
}

/**
 * The events of a change of a ticket (§4.5): one per changed field, in a fixed order. A
 * description edit records only that it happened – the text keeps its history in content
 * revisions (S1-12). A reference changes when its ID changes; a renamed person is no change.
 */
export function fieldChanges(
  before: TrackedTicketFields,
  after: TrackedTicketFields,
): FieldChange[] {
  const changes: FieldChange[] = [];
  if (before.title !== after.title) {
    changes.push({ type: 'title_changed', data: { from: before.title, to: after.title } });
  }
  if (before.description !== after.description) {
    changes.push({ type: 'description_edited', data: null });
  }
  if (before.type !== after.type) {
    changes.push({ type: 'type_changed', data: { from: before.type, to: after.type } });
  }
  if (before.priority !== after.priority) {
    changes.push({ type: 'priority_changed', data: { from: before.priority, to: after.priority } });
  }
  if ((before.assignee?.id ?? null) !== (after.assignee?.id ?? null)) {
    changes.push({ type: 'assignee_changed', data: { from: before.assignee, to: after.assignee } });
  }
  return changes;
}
