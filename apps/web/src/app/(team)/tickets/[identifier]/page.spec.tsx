import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const requireSession = vi.fn();
vi.mock('../../../../lib/auth/session.js', () => ({ requireSession }));
vi.mock('../../../../lib/env/env.js', () => ({ getEnv: () => ({ attachmentMaxSizeMb: 25 }) }));
const getTicketPage = vi.fn();
vi.mock('../../../../features/tickets/ticket-page.js', () => ({ getTicketPage }));
vi.mock('../../../../lib/query-client/server-query-client.js', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  const client = new QueryClient();
  return { getServerQueryClient: () => client };
});

const { default: TicketPage } = await import('./page.js');
const { TeamTicketView } =
  await import('../../../../features/tickets/components/team-ticket-view.js');
const { RateLimitedNotice } =
  await import('../../../../features/app-shell/components/rate-limited-notice.js');
const { ApiError } = await import('../../../../lib/errors/api-error.js');

afterEach(() => {
  vi.clearAllMocks();
});

describe('TicketPage', () => {
  it('loads the ticket through the shared loader and renders the team ticket view', async () => {
    const element = (await TicketPage({
      params: Promise.resolve({ identifier: 'ERP-12' }),
    })) as ReactElement<{
      children: ReactElement<{ identifier: string; attachmentMaxSizeMb: number }>;
    }>;

    expect(requireSession).toHaveBeenCalledOnce();
    expect(getTicketPage).toHaveBeenCalledWith('ERP-12', 'team');
    expect(element.props.children).toMatchObject({
      type: TeamTicketView,
      props: { identifier: 'ERP-12', attachmentMaxSizeMb: 25 },
    });
  });

  it('tells a person over the rate limit when to try again (#382)', async () => {
    const error = new ApiError(429, 'request.rate_limited', [], 45);
    getTicketPage.mockRejectedValueOnce(error);

    const element = await TicketPage({ params: Promise.resolve({ identifier: 'ERP-12' }) });

    expect(element).toMatchObject({ type: RateLimitedNotice, props: { error } });
  });

  it('shows the not-found page when the loader finds no ticket', async () => {
    getTicketPage.mockRejectedValueOnce(new Error('NEXT_NOT_FOUND'));

    await expect(
      TicketPage({ params: Promise.resolve({ identifier: 'ERP-999' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
