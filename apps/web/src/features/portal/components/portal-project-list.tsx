'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@trybun/ui/components/button';
import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { LoadingStatus } from '../../app-shell/components/loading-status.js';
import { projectsQueryOptions } from '../../projects/queries.js';
import { portalProjectHref } from '../hrefs.js';

/**
 * The active projects of an end user on the portal root (§5.7): one large card per project,
 * opening its project home – one column on phones, two from the tablet width on (Rule 9). While the
 * browser reads them, a status says so in their place (§18.5, #428).
 */
export function PortalProjectList() {
  const t = useTranslations('portal.root');
  const errorMessage = useErrorMessage();
  const projects = useInfiniteQuery(projectsQueryOptions(browserApiClient, 'active'));
  // Only a failure of the first read replaces the rows; a failed **Load more** keeps them (#434).
  if (projects.isLoadingError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(projects.error)}
      </p>
    );
  }
  if (projects.isPending) {
    // Never the empty grid (#428).
    return <LoadingStatus fetchStatus={projects.fetchStatus}>{t('loading')}</LoadingStatus>;
  }
  const items = projects.data.pages.flatMap((page) => page.items);
  // The page shows the empty state itself when its prefetch read the projects; this one follows a
  // read of the browser, after a failed prefetch (#428).
  if (items.length === 0) {
    return (
      <div className="flex max-w-prose flex-col gap-1">
        <p className="font-medium">{t('emptyTitle')}</p>
        <p className="text-muted-foreground">{t('emptyDescription')}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((project) => (
          <li key={project.id}>
            <Link
              href={portalProjectHref(project.id)}
              className="flex min-h-20 items-center gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground hover:bg-muted focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="min-w-0 flex-1 truncate text-lg font-medium">{project.name}</span>
              <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      {projects.isError && !projects.isFetchingNextPage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(projects.error)}
        </p>
      )}
      {projects.hasNextPage && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={projects.isFetchingNextPage}
          onClick={() => void projects.fetchNextPage()}
        >
          {projects.isFetchingNextPage ? t('loadingMore') : t('loadMore')}
        </Button>
      )}
    </div>
  );
}
