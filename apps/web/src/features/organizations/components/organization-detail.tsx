'use client';

import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@trybun/ui/components/alert';
import { Button } from '@trybun/ui/components/button';
import { ArchiveIcon, ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { organizationQueryOptions } from '../queries.js';
import { ORGANIZATIONS_HREF } from '../search-params.js';
import { OrganizationDangerZone } from './organization-danger-zone.js';
import { OrganizationDomains } from './organization-domains.js';
import { OrganizationGeneralForm } from './organization-general-form.js';
import { OrganizationMembers } from './organization-members.js';
import { OrganizationProjects } from './organization-projects.js';
import { useUnarchive } from './use-unarchive.js';

/**
 * An organization in the Administrator panel (§7.3): its name, e-mail domains, projects and
 * members on one page, and the Danger zone; every action is shown by `allowedActions` (§18.5).
 * An archived organization shows a banner with Unarchive, and its sections read-only.
 */
export function OrganizationDetail({ organizationId }: { organizationId: string }) {
  const t = useTranslations('organizations');
  const unarchive = useUnarchive();
  const { data: organization, error } = useQuery(
    organizationQueryOptions(browserApiClient, organizationId),
  );
  // The organization was deleted, e.g. by another Administrator.
  if (error instanceof ApiError && error.status === 404) {
    notFound();
  }
  if (organization === undefined) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href={ORGANIZATIONS_HREF}
          className="flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none xl:pointer-fine:min-h-0"
        >
          <ChevronLeftIcon aria-hidden className="size-4" />
          {t('detail.back')}
        </Link>
        <h2 className="text-xl font-bold break-words">{organization.name}</h2>
      </div>
      {organization.state === 'archived' && (
        <Alert variant="warning">
          <ArchiveIcon aria-hidden />
          <AlertTitle>{t('detail.archivedBanner')}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            {t('detail.archivedDescription')}
            {organization.allowedActions.includes('unarchive') && (
              <Button
                variant="outline"
                className="w-full md:w-fit"
                onClick={() => unarchive(organization)}
              >
                {t('danger.unarchive')}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      <OrganizationGeneralForm key={organization.version} organization={organization} />
      <OrganizationDomains organization={organization} />
      <OrganizationProjects organization={organization} />
      <OrganizationMembers organization={organization} />
      <OrganizationDangerZone organization={organization} />
    </div>
  );
}
