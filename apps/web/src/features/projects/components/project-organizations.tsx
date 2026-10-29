'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Badge } from '@trybun/ui/components/badge';
import { Button } from '@trybun/ui/components/button';
import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { organizationsQueryOptions } from '../../organizations/queries.js';
import { organizationHref } from '../../organizations/search-params.js';

/**
 * The organizations that may access a project, for the Administrator (§7.3): read-only, each
 * linking to the organization, where the access is changed – one way to edit it. Active ones come
 * first, archived ones are marked.
 */
export function ProjectOrganizations({ projectId }: { projectId: string }) {
  const t = useTranslations('projects.organizations');
  const errorMessage = useErrorMessage();
  const active = useInfiniteQuery(organizationsQueryOptions(browserApiClient, 'active', projectId));
  const archived = useInfiniteQuery(
    organizationsQueryOptions(browserApiClient, 'archived', projectId),
  );
  const error = active.error ?? archived.error;
  const items = [active, archived].flatMap(
    (query) => query.data?.pages.flatMap((page) => page.items) ?? [],
  );

  return (
    <section aria-labelledby="project-organizations-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="project-organizations-title" className="text-lg font-semibold">
          {t('title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      {error !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(error)}
        </p>
      ) : (
        active.isSuccess &&
        archived.isSuccess &&
        items.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((organization) => (
          <li key={organization.id}>
            <Link
              href={organizationHref(organization.id)}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate font-medium">{organization.name}</span>
                {organization.state === 'archived' && (
                  <Badge variant="outline">{t('archived')}</Badge>
                )}
              </span>
              <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      {(active.hasNextPage || archived.hasNextPage) && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={active.isFetchingNextPage || archived.isFetchingNextPage}
          onClick={() => void (active.hasNextPage ? active : archived).fetchNextPage()}
        >
          {t('loadMore')}
        </Button>
      )}
    </section>
  );
}
