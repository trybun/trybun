import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.fn((): never => {
  throw new Error('NEXT_REDIRECT');
});
vi.mock('next/navigation.js', () => ({ redirect }));
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

  it.each(['erp-12', 'Erp-12'])(
    'redirects %s to the canonical upper-case identifier before validating it',
    async (identifier) => {
      await expect(TicketPage({ params: Promise.resolve({ identifier }) })).rejects.toThrow(
        'NEXT_REDIRECT',
      );

      expect(redirect).toHaveBeenCalledWith('/tickets/ERP-12');
      expect(getTicketPage).not.toHaveBeenCalled();
    },
  );

  it('shows the not-found page when the loader finds no ticket', async () => {
    getTicketPage.mockRejectedValueOnce(new Error('NEXT_NOT_FOUND'));

    await expect(
      TicketPage({ params: Promise.resolve({ identifier: 'ERP-999' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(redirect).not.toHaveBeenCalled();
  });
});
