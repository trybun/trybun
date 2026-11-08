import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { redirect } from 'next/navigation.js';
import { z } from 'zod';
import { TeamTicketView } from '../../../../features/tickets/components/team-ticket-view.js';
import { ticketHref } from '../../../../features/tickets/hrefs.js';
import { getTicketPage } from '../../../../features/tickets/ticket-page.js';
import { requireSession } from '../../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../../lib/query-client/server-query-client.js';

const paramsSchema = z.object({ identifier: z.string() });

/**
 * A ticket in the team ticket view (§3.2, §4.5, change specification of S1-10). A lower-case
 * identifier goes to its canonical upper-case form first, because the identifier schema accepts
 * only upper case; a ticket the person cannot see shows the not-found page (§5.3).
 */
export default async function TicketPage({ params }: { params: Promise<{ identifier: string }> }) {
  const { identifier } = paramsSchema.parse(await params);
  const canonical = identifier.toUpperCase();
  if (canonical !== identifier) {
    redirect(ticketHref(canonical));
  }
  await requireSession();
  await getTicketPage(identifier, 'team');
  return (
    <HydrationBoundary state={dehydrate(getServerQueryClient())}>
      <TeamTicketView identifier={identifier} />
    </HydrationBoundary>
  );
}
