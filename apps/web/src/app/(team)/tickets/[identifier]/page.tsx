import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { z } from 'zod';
import { RateLimitedNotice } from '../../../../features/app-shell/components/rate-limited-notice.js';
import { TeamTicketView } from '../../../../features/tickets/components/team-ticket-view.js';
import { getTicketPage } from '../../../../features/tickets/ticket-page.js';
import { readOrRateLimited } from '../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../lib/auth/session.js';
import { getEnv } from '../../../../lib/env/env.js';
import { getServerQueryClient } from '../../../../lib/query-client/server-query-client.js';

const paramsSchema = z.object({ identifier: z.string() });

/**
 * A ticket in the team ticket view (§3.2, §4.5, change specification of S1-10). The loader sends a
 * lower-case identifier to its canonical upper-case form; a ticket the person cannot see shows the
 * not-found page (§5.3), and a person over the rate limit is told so (§14.4).
 */
export default async function TicketPage({ params }: { params: Promise<{ identifier: string }> }) {
  const { identifier } = paramsSchema.parse(await params);
  await requireSession();
  const { rateLimited } = await readOrRateLimited(getTicketPage(identifier, 'team'));
  if (rateLimited !== undefined) {
    return <RateLimitedNotice error={rateLimited} />;
  }
  return (
    <HydrationBoundary state={dehydrate(getServerQueryClient())}>
      <TeamTicketView identifier={identifier} attachmentMaxSizeMb={getEnv().attachmentMaxSizeMb} />
    </HydrationBoundary>
  );
}
