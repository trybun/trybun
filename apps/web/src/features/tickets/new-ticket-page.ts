import 'server-only';
import { MAX_PAGE_LIMIT } from '@trybun/contracts/pagination';
import { ticketTypeSchema } from '@trybun/contracts/tickets';
import { getLocale, getTranslations } from 'next-intl/server';
import { allPageItems } from '../../lib/api-client/all-pages.js';
import { dataOf } from '../../lib/api-client/api-client.js';
import { getServerApiClient } from '../../lib/api-client/server-api-client.js';
import { getServerQueryClient } from '../../lib/query-client/server-query-client.js';
import { currentUserQueryOptions } from '../users/queries.js';
import type { CreatableProject } from './components/team-ticket-form.js';
import type { TicketTemplates } from './ticket-form-templates.js';

/**
 * The data of the full ticket form (S1-10): the active projects whose `allowedActions` contain
 * `create_ticket` (all pages – a person works in few projects), and the description templates in
 * the account language, else the request language (§3.4, Q4). The form needs no project request
 * of its own, and the header that links to it none at all (Q7).
 */
export async function getNewTicketPage(): Promise<{
  projects: CreatableProject[];
  templates: TicketTemplates;
}> {
  const client = await getServerApiClient();
  const [projects, user] = await Promise.all([
    creatableProjects(),
    // The application shell has fetched the account for the same request already.
    getServerQueryClient().ensureQueryData(currentUserQueryOptions(client)),
  ]);
  const t = await getTranslations({
    locale: user.language ?? (await getLocale()),
    namespace: 'tickets.templates',
  });
  const templates = Object.fromEntries(
    ticketTypeSchema.options.map((type) => [type, t(type)]),
  ) as TicketTemplates;
  return { projects, templates };
}

async function creatableProjects(): Promise<CreatableProject[]> {
  const client = await getServerApiClient();
  const projects = await allPageItems((cursor) =>
    dataOf(
      client.GET('/api/v1/projects', {
        params: {
          query: { state: 'active', limit: MAX_PAGE_LIMIT, ...(cursor === null ? {} : { cursor }) },
        },
      }),
    ),
  );
  return projects
    .filter(({ allowedActions }) => allowedActions.includes('create_ticket'))
    .map(({ id, name, allowedActions }) => ({ id, name, allowedActions }));
}
