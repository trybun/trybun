import type { Metadata } from 'next';
import { redirect } from 'next/navigation.js';
import { getTranslations } from 'next-intl/server';
import { RateLimitedNotice } from '../../../../../../../features/app-shell/components/rate-limited-notice.js';
import { portalProjectHref } from '../../../../../../../features/portal/hrefs.js';
import { loadPortalProject } from '../../../../../../../features/portal/project-page.js';
import { NewTicketForm } from '../../../../../../../features/tickets/components/new-ticket-form.js';
import { creationVisibilityOptions } from '../../../../../../../features/tickets/visibility.js';
import {
  metadataAfterRead,
  readOrRateLimited,
} from '../../../../../../../lib/api-client/server-api-client.js';
import { getEnv } from '../../../../../../../lib/env/env.js';

/** A missing or invisible project gets the translated not-found title of the tab (#404). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  return metadataAfterRead(loadPortalProject((await params).projectId));
}

/**
 * The simplified ticket form as a page, not a dialog (§3.3, Q6): on phones the description needs
 * the full height, and the address survives a reload. A project that takes no tickets (archived)
 * returns to its project home, which says why. A person over the rate limit is told so (§14.4).
 */
export default async function NewTicketPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [t, { data: project, rateLimited }] = await Promise.all([
    getTranslations('portal.newTicket'),
    readOrRateLimited(loadPortalProject(projectId)),
  ]);
  if (rateLimited !== undefined) {
    return <RateLimitedNotice error={rateLimited} />;
  }
  if (!project.allowedActions.includes('create_ticket')) {
    redirect(portalProjectHref(project.id));
  }
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t('heading')}</h1>
        <p className="text-sm text-muted-foreground">{t('project', { name: project.name })}</p>
      </div>
      <NewTicketForm
        projectId={project.id}
        visibilityOptions={creationVisibilityOptions(project.allowedActions)}
        attachmentMaxSizeMb={getEnv().attachmentMaxSizeMb}
      />
    </div>
  );
}
