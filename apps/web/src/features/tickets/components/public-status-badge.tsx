'use client';

import type { TicketPublicStatus } from '@trybun/contracts/tickets';
import { Badge } from '@trybun/ui/components/badge';
import {
  CheckCircle2Icon,
  CircleDotIcon,
  CircleSlashIcon,
  InboxIcon,
  type LucideIcon,
  MessageCircleWarningIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

const STYLES: Record<
  TicketPublicStatus,
  { variant: 'secondary' | 'warning' | 'info' | 'success' | 'outline'; icon: LucideIcon }
> = {
  received: { variant: 'secondary', icon: InboxIcon },
  awaiting_reply: { variant: 'warning', icon: MessageCircleWarningIcon },
  in_progress: { variant: 'info', icon: CircleDotIcon },
  resolved: { variant: 'success', icon: CheckCircle2Icon },
  closed: { variant: 'outline', icon: CircleSlashIcon },
};

/**
 * The public status of a ticket (§4.2) as a badge with its label and an icon, so the state never
 * relies on colour alone (§13.4); `awaiting_reply` stands out, because the requester has to act.
 */
export function PublicStatusBadge({ status }: { status: TicketPublicStatus }) {
  const t = useTranslations('tickets.publicStatuses');
  const { variant, icon: Icon } = STYLES[status];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden data-icon="inline-start" />
      {t(status)}
    </Badge>
  );
}
