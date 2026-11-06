import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@trybun/ui/components/alert';
import { buttonVariants } from '@trybun/ui/components/button';
import { cn } from '@trybun/ui/lib/utils';
import { ArchiveIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation.js';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { myTicketsHref, newTicketHref } from '../../../../../features/portal/hrefs.js';
import { getPortalProject } from '../../../../../features/portal/project-page.js';
import { MyTicketsList } from '../../../../../features/tickets/components/my-tickets-list.js';
import { myTicketsQueryOptions } from '../../../../../features/tickets/queries.js';
import { getServerApiClient } from '../../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../../../lib/query-client/server-query-client.js';

/** The number of the project's tickets the project home shows; **Show all** opens the rest. */
const PROJECT_HOME_TICKETS = 10;

const paramsSchema = z.object({ projectId: z.uuid() });

/**
 * The project home of the portal (§5.7): the project name, **Create ticket** – the first of the two
 * steps of a new ticket – and "My tickets" of the project. An archived project shows its read-only
 * banner instead of **Create ticket** (§7.3). No search field until the portal search (S2-03, Q5).
 */
export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    notFound();
  }
  await requireSession();
  const [t, project, client] = await Promise.all([
    getTranslations('portal.projectHome'),
    getPortalProject(parsed.data.projectId),
    getServerApiClient(),
  ]);
  const queryClient = getServerQueryClient();
  const ticketsOptions = myTicketsQueryOptions(client, {
    projectId: project.id,
    limit: PROJECT_HOME_TICKETS,
  });
  await queryClient.prefetchInfiniteQuery(ticketsOptions);
  const hasMoreTickets =
    typeof queryClient.getQueryData(ticketsOptions.queryKey)?.pages[0]?.nextCursor === 'string';
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold break-words">{project.name}</h1>
      {project.state === 'archived' && (
        <Alert variant="warning">
          <ArchiveIcon aria-hidden />
          <AlertDescription>{t('archivedBanner')}</AlertDescription>
        </Alert>
      )}
      {project.allowedActions.includes('create_ticket') && (
        <Link
          href={newTicketHref(project.id)}
          className={cn(buttonVariants({ size: 'lg' }), 'w-full md:w-fit')}
          data-tour="portal-project-create-ticket"
        >
          <PlusIcon aria-hidden />
          {t('createTicket')}
        </Link>
      )}
      <section aria-labelledby="project-tickets" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="project-tickets" className="text-lg font-semibold">
            {t('myTickets')}
          </h2>
          {hasMoreTickets && (
            <Link
              href={myTicketsHref(project.id)}
              className="flex min-h-11 items-center text-sm font-medium text-link underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none xl:pointer-fine:min-h-0"
            >
              {t('showAll')}
            </Link>
          )}
        </div>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <MyTicketsList projectId={project.id} limit={PROJECT_HOME_TICKETS} />
        </HydrationBoundary>
      </section>
    </div>
  );
}
