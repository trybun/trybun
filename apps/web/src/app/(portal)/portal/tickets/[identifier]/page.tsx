import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { cache } from 'react';
import { RateLimitedNotice } from '../../../../../features/app-shell/components/rate-limited-notice.js';
import { TicketView } from '../../../../../features/tickets/components/ticket-view.js';
import { getTicketPage } from '../../../../../features/tickets/ticket-page.js';
import {
  metadataAfterRead,
  readOrRateLimited,
} from '../../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../../lib/auth/session.js';
import { getEnv } from '../../../../../lib/env/env.js';
import { getServerQueryClient } from '../../../../../lib/query-client/server-query-client.js';

/** The read of the page, shared with its metadata in one request. */
const loadTicket = cache(async (identifier: string) => {
  await requireSession();
  return getTicketPage(identifier, 'portal');
});

/** A missing or invisible ticket gets the translated not-found title of the tab (#404). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ identifier: string }>;
}): Promise<Metadata> {
  const { identifier } = await params;
  return metadataAfterRead(loadTicket(identifier));
}

/**
 * A ticket in the portal (§5.7): its public status, description, public timeline and comments
 * (S1-12). A person over the rate limit is told so (§14.4).
 */
export default async function PortalTicketPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  const { rateLimited } = await readOrRateLimited(loadTicket(identifier));
  if (rateLimited !== undefined) {
    return <RateLimitedNotice error={rateLimited} />;
  }
  return (
    <HydrationBoundary state={dehydrate(getServerQueryClient())}>
      <TicketView identifier={identifier} attachmentMaxSizeMb={getEnv().attachmentMaxSizeMb} />
    </HydrationBoundary>
  );
}
