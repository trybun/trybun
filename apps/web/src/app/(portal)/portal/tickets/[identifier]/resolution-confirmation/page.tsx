import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { resolutionAnswerSchema } from '@trybun/contracts/tickets';
import { redirect } from 'next/navigation.js';
import { z } from 'zod';
import { portalTicketHref } from '../../../../../../features/portal/hrefs.js';
import { ResolutionConfirmation } from '../../../../../../features/tickets/components/resolution-confirmation.js';
import { getTicketPage } from '../../../../../../features/tickets/ticket-page.js';
import { requireSession } from '../../../../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../../../../lib/query-client/server-query-client.js';

const searchParamsSchema = z.object({ answer: resolutionAnswerSchema.optional().catch(undefined) });

/**
 * The confirmation page of the resolution answer (§4.3, Q14), for the signed-in requester; S1-15
 * adds the signed token of the e-mail links. Without a valid answer it is the ticket itself.
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
  await requireSession();
  await getTicketPage(identifier, 'portal');
  if (answer === undefined) {
    redirect(portalTicketHref(identifier));
  }
  return (
    <HydrationBoundary state={dehydrate(getServerQueryClient())}>
      <ResolutionConfirmation identifier={identifier} answer={answer} />
    </HydrationBoundary>
  );
}
