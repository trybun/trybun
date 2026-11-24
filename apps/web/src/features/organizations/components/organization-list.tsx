'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { OrganizationState } from '@trybun/contracts/organizations';
import { Button } from '@trybun/ui/components/button';
import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { LoadingStatus } from '../../app-shell/components/loading-status.js';
import { QueryErrorAlert } from '../../app-shell/components/query-error-alert.js';
import { organizationsQueryOptions } from '../queries.js';
import { organizationHref } from '../search-params.js';

/**
 * The organizations of one state, sorted by name (§7.3): one row per organization with its name,
 * e-mail domains and member count, opening its detail. Rows are full-width cards with 44 px
 * targets on every device, as the projects list (Rule 9). While the browser reads them, a status
 * says so in their place (§18.5, #428).
 */
export function OrganizationList({ state }: { state: OrganizationState }) {
  const t = useTranslations('organizations.list');
  const errorMessage = useErrorMessage();
  const organizations = useInfiniteQuery(organizationsQueryOptions(browserApiClient, state));

  // Only a failure of the first read replaces the rows; a failed **Load more** keeps them (#434).
  if (organizations.isLoadingError) {
    return (
      <QueryErrorAlert
        error={organizations.error}
        message={errorMessage(organizations.error)}
        headingLevel={3}
      />
    );
  }
  if (organizations.isPending) {
    // Never the empty list or the empty state, which look like "no organizations" (#428).
    return <LoadingStatus fetchStatus={organizations.fetchStatus}>{t('loading')}</LoadingStatus>;
  }
  const items = organizations.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {state === 'active' ? t('emptyActive') : t('emptyArchived')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {items.map((organization) => (
          <li key={organization.id}>
            <Link
              href={organizationHref(organization.id)}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground hover:bg-muted focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-3">
                <span className="truncate font-medium">{organization.name}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {organization.domains.length === 0
                    ? t('noDomains')
                    : organization.domains.join(', ')}
                </span>
                <span className="text-sm whitespace-nowrap text-muted-foreground">
                  {t('memberCount', { count: organization.memberCount })}
                </span>
              </span>
              <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      {organizations.isError && !organizations.isFetchingNextPage && (
        <QueryErrorAlert
          error={organizations.error}
          message={errorMessage(organizations.error)}
          headingLevel={3}
          offersReload={false}
        />
      )}
      {organizations.hasNextPage && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={organizations.isFetchingNextPage}
          onClick={() => void organizations.fetchNextPage()}
        >
          {organizations.isFetchingNextPage ? t('loadingMore') : t('loadMore')}
        </Button>
      )}
    </div>
  );
}
