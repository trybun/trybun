import { getTranslations } from 'next-intl/server';
import { TeamTicketForm } from '../../../../features/tickets/components/team-ticket-form.js';
import { getNewTicketPage } from '../../../../features/tickets/new-ticket-page.js';
import { newTicketSearchParamsSchema } from '../../../../features/tickets/search-params.js';
import { requireSession } from '../../../../lib/auth/session.js';
import { getEnv } from '../../../../lib/env/env.js';

/**
 * The full ticket form of the team (§3.3, change specification of S1-10), opened from the
 * **New ticket** button of the header or with the project of a list in `?projectId=` (Q6, Q7).
 * Without a project that allows `create_ticket` the page says so instead of the form.
 */
export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = newTicketSearchParamsSchema.parse(await searchParams);
  await requireSession();
  const [t, { projects, templates }] = await Promise.all([
    getTranslations('tickets.form'),
    getNewTicketPage(),
  ]);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('heading')}</h1>
      {projects.length === 0 ? (
        <p className="text-muted-foreground">{t('noProjects')}</p>
      ) : (
        <TeamTicketForm
          projects={projects}
          requestedProjectId={projectId}
          templates={templates}
          attachmentMaxSizeMb={getEnv().attachmentMaxSizeMb}
        />
      )}
    </div>
  );
}
