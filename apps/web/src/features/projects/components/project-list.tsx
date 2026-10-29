'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { ProjectState } from '@trybun/contracts/projects';
import { Badge } from '@trybun/ui/components/badge';
import { Button } from '@trybun/ui/components/button';
import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { projectsQueryOptions } from '../queries.js';
import { projectSettingsHref } from '../search-params.js';

/**
 * The projects of one state the person can see, sorted by name (§7.3): one row per project with
 * its name, key and the person's role, opening its settings. Rows are full-width cards with
 * 44 px targets on every device (Rule 9).
 */
export function ProjectList({ state }: { state: ProjectState }) {
  const t = useTranslations('projects');
  const errorMessage = useErrorMessage();
  const projects = useInfiniteQuery(projectsQueryOptions(browserApiClient, state));

  if (projects.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(projects.error)}
      </p>
    );
  }
  const items = projects.data?.pages.flatMap((page) => page.items) ?? [];
  if (projects.isSuccess && items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {state === 'active' ? t('list.emptyActive') : t('list.emptyArchived')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {items.map((project) => (
          <li key={project.id}>
            <Link
              href={projectSettingsHref(project.id)}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-3">
                <span className="truncate font-medium">{project.name}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {project.key}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {project.role === null ? t('list.noRole') : t(`roles.${project.role}`)}
                  </span>
                </span>
              </span>
              <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      {projects.hasNextPage && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={projects.isFetchingNextPage}
          onClick={() => void projects.fetchNextPage()}
        >
          {projects.isFetchingNextPage ? t('list.loadingMore') : t('list.loadMore')}
        </Button>
      )}
    </div>
  );
}
