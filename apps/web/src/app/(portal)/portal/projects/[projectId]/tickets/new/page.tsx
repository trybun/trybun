import { notFound, redirect } from 'next/navigation.js';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { portalProjectHref } from '../../../../../../../features/portal/hrefs.js';
import { getPortalProject } from '../../../../../../../features/portal/project-page.js';
import { NewTicketForm } from '../../../../../../../features/tickets/components/new-ticket-form.js';
import { requireSession } from '../../../../../../../lib/auth/session.js';
import { getEnv } from '../../../../../../../lib/env/env.js';

const paramsSchema = z.object({ projectId: z.uuid() });

/**
 * The simplified ticket form as a page, not a dialog (§3.3, Q6): on phones the description needs
 * the full height, and the address survives a reload. A project that takes no tickets (archived)
 * returns to its project home, which says why.
 */
export default async function NewTicketPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    notFound();
  }
  await requireSession();
  const [t, project] = await Promise.all([
    getTranslations('portal.newTicket'),
    getPortalProject(parsed.data.projectId),
  ]);
  if (!project.allowedActions.includes('create_ticket')) {
    redirect(portalProjectHref(project.id));
  }
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t('heading')}</h1>
        <p className="text-sm text-muted-foreground">{t('project', { name: project.name })}</p>
      </div>
      <NewTicketForm projectId={project.id} attachmentMaxSizeMb={getEnv().attachmentMaxSizeMb} />
    </div>
  );
}
