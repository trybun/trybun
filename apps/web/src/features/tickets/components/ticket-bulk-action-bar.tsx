'use client';

import { useQuery } from '@tanstack/react-query';
import type { BulkTicketChange, TicketListItem } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { assignableMembersQueryOptions } from '../queries.js';
import type { PickerGroup } from './field-sheet.js';
import { FieldPicker } from './field-picker.js';
import { LazyBulkRejectDialog } from './lazy-bulk-dialogs.js';
import { STATUS_KINDS } from './status-control.js';

const ME = 'me';
const NONE = 'none';

/**
 * The bulk action bar (§8.1, S1-13): "{count} selected", **Status**, **Priority**, **Assignee**
 * and **Clear selection** – above the table from the tablet width on, fixed at the bottom with the
 * safe area on phones (§18.6). An action is offered while one selected ticket allows it; tickets
 * that do not are sent anyway and come back as "not permitted" – the UI never derives
 * permissions from results (§18.3).
 */
export function TicketBulkActionBar({
  selected,
  currentUserId,
  isPending,
  onChange,
  onClear,
}: {
  selected: TicketListItem[];
  currentUserId: string;
  isPending: boolean;
  onChange: (change: BulkTicketChange) => void;
  onClear: () => void;
}) {
  const t = useTranslations('tickets');
  const [isRejecting, setIsRejecting] = useState(false);
  const allows = (...actions: TicketListItem['allowedActions']) =>
    selected.some((ticket) => actions.some((action) => ticket.allowedActions.includes(action)));
  const projectIds = new Set(selected.map((ticket) => ticket.projectId));
  // Other people only when every ticket is in one project and the person may assign them (Q13).
  const [projectId] = projectIds;
  const canAssignOthers =
    projectIds.size === 1 && selected.every((ticket) => ticket.allowedActions.includes('assign'));
  const people = useQuery({
    ...assignableMembersQueryOptions(browserApiClient, projectId ?? '', ''),
    enabled: canAssignOthers && projectId !== undefined,
  });

  const statusGroups: PickerGroup[] = STATUS_KINDS.map(({ kind, statuses }) => ({
    label: t(`status.kinds.${kind}`),
    options: statuses
      .filter((status) => status !== 'duplicate')
      .map((status) => ({ value: status, label: t(`statuses.${status}`) })),
  }));
  const priorityGroups: PickerGroup[] = [
    {
      label: '',
      options: (['low', 'normal', 'high', 'critical'] as const).map((priority) => ({
        value: priority,
        label: t(`priorities.${priority}`),
      })),
    },
  ];
  const assigneeGroups: PickerGroup[] = [
    {
      label: '',
      options: [
        { value: ME, label: t('list.bulk.assignToMe') },
        { value: NONE, label: t('list.bulk.unassigned') },
      ],
    },
    ...(canAssignOthers
      ? [
          {
            label: t('list.bulk.people'),
            options: (people.data?.items ?? [])
              .filter(({ user }) => user.id !== currentUserId)
              .map(({ user }) => ({ value: user.id, label: user.displayName ?? user.id })),
          },
        ]
      : []),
  ];

  return (
    <div
      role="region"
      aria-label={t('list.selection.bar')}
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-border bg-background p-3 pb-safe-offset-17 shadow-lg md:static md:z-auto md:flex-row md:flex-wrap md:items-center md:rounded-lg md:border md:p-2 md:shadow-none"
    >
      <p className="text-sm font-medium md:mr-2" aria-live="polite">
        {t('list.selection.selected', { count: selected.length })}
      </p>
      <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap">
        {allows('change_status') && (
          <FieldPicker
            label={t('list.bulk.status')}
            placeholder={t('list.bulk.status')}
            value={null}
            groups={statusGroups}
            disabled={isPending}
            onValueChange={(status) => {
              if (status === 'rejected') {
                setIsRejecting(true);
                return;
              }
              onChange({
                field: 'status',
                status: status as Exclude<TicketListItem['status'], 'duplicate' | 'rejected'>,
              });
            }}
          />
        )}
        {allows('update_fields') && (
          <FieldPicker
            label={t('list.bulk.priority')}
            placeholder={t('list.bulk.priority')}
            value={null}
            groups={priorityGroups}
            disabled={isPending}
            onValueChange={(priority) =>
              onChange({ field: 'priority', priority: priority as TicketListItem['priority'] })
            }
          />
        )}
        {allows('assign', 'assign_self') && (
          <FieldPicker
            label={t('list.bulk.assignee')}
            placeholder={t('list.bulk.assignee')}
            value={null}
            groups={assigneeGroups}
            disabled={isPending}
            onValueChange={(value) =>
              onChange({
                field: 'assignee',
                assigneeId: value === ME ? currentUserId : value === NONE ? null : value,
              })
            }
          />
        )}
      </div>
      <Button type="button" variant="ghost" onClick={onClear} className="md:ml-auto">
        {t('list.selection.clear')}
      </Button>
      {isRejecting && (
        <LazyBulkRejectDialog
          count={selected.length}
          onReject={(rejectionReason) => {
            setIsRejecting(false);
            onChange({ field: 'status', status: 'rejected', rejectionReason });
          }}
          onClose={() => setIsRejecting(false)}
        />
      )}
    </div>
  );
}
