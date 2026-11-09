import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { z } from 'zod';
import { TeamTicketView } from '../../../../features/tickets/components/team-ticket-view.js';
import { getTicketPage } from '../../../../features/tickets/ticket-page.js';
import { requireSession } from '../../../../lib/auth/session.js';
import { getEnv } from '../../../../lib/env/env.js';
import { getServerQueryClient } from '../../../../lib/query-client/server-query-client.js';

const paramsSchema = z.object({ identifier: z.string() });

/**
 * A ticket in the team ticket view (§3.2, §4.5, change specification of S1-10). The loader sends a
 * lower-case identifier to its canonical upper-case form; a ticket the person cannot see shows the
 * not-found page (§5.3).
 */
export default async function TicketPage({ params }: { params: Promise<{ identifier: string }> }) {
  const { identifier } = paramsSchema.parse(await params);
  await requireSession();
  await getTicketPage(identifier, 'team');
  return (
    <HydrationBoundary state={dehydrate(getServerQueryClient())}>
      <TeamTicketView identifier={identifier} attachmentMaxSizeMb={getEnv().attachmentMaxSizeMb} />
    </HydrationBoundary>
  );
}
