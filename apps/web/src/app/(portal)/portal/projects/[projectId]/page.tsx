import { Alert, AlertDescription } from '@trybun/ui/components/alert';
import { buttonVariants } from '@trybun/ui/components/button';
import { cn } from '@trybun/ui/lib/utils';
import { ArchiveIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation.js';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { newTicketHref } from '../../../../../features/portal/hrefs.js';
import { getPortalProject } from '../../../../../features/portal/project-page.js';
import { requireSession } from '../../../../../lib/auth/session.js';

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
  const [t, project] = await Promise.all([
    getTranslations('portal.projectHome'),
    getPortalProject(parsed.data.projectId),
  ]);
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
    </div>
  );
}
