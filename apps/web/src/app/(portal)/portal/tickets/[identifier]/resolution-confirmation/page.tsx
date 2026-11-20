import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { type ResolutionAnswer, resolutionAnswerSchema } from '@trybun/contracts/tickets';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation.js';
import { cache } from 'react';
import { z } from 'zod';
import { RateLimitedNotice } from '../../../../../../features/app-shell/components/rate-limited-notice.js';
import {
  portalTicketHref,
  resolutionConfirmationHref,
} from '../../../../../../features/portal/hrefs.js';
import { ResolutionConfirmation } from '../../../../../../features/tickets/components/resolution-confirmation.js';
import { getTicketPage } from '../../../../../../features/tickets/ticket-page.js';
import {
  metadataAfterRead,
  readOrRateLimited,
} from '../../../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../../../../lib/query-client/server-query-client.js';

const searchParamsSchema = z.object({ answer: resolutionAnswerSchema.optional().catch(undefined) });

/**
 * The read of the page, shared with its metadata in one request. A lower-case identifier comes
 * back to this page, upper case, with its answer.
 */
const loadTicket = cache(async (identifier: string, answer: ResolutionAnswer | undefined) => {
  await requireSession();
  return getTicketPage(identifier, 'portal', (canonical) =>
    answer === undefined
      ? portalTicketHref(canonical)
      : resolutionConfirmationHref(canonical, answer),
  );
});

/** A missing or invisible ticket gets the translated not-found title of the tab (#404). */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ identifier: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [{ identifier }, { answer }] = await Promise.all([
    params,
    searchParams.then((values) => searchParamsSchema.parse(values)),
  ]);
  return metadataAfterRead(loadTicket(identifier, answer));
}

/**
 * The confirmation page of the resolution answer (§4.3, Q14), for the signed-in requester; S1-15
 * adds the signed token of the e-mail links. Without a valid answer it is the ticket itself. A
 * person over the rate limit is told so (§14.4).
 */
export default async function ResolutionConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ identifier: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ identifier }, { answer }] = await Promise.all([
    params,
    searchParams.then((values) => searchParamsSchema.parse(values)),
  ]);
  const { rateLimited } = await readOrRateLimited(loadTicket(identifier, answer));
  if (rateLimited !== undefined) {
    return <RateLimitedNotice error={rateLimited} />;
  }
  if (answer === undefined) {
    redirect(portalTicketHref(identifier));
  }
  return (
    <HydrationBoundary state={dehydrate(getServerQueryClient())}>
      <ResolutionConfirmation identifier={identifier} answer={answer} />
    </HydrationBoundary>
  );
}
