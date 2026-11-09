import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const redirect = vi.fn((): never => {
  throw new Error('NEXT_REDIRECT');
});
const notFound = vi.fn((): never => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation.js', () => ({ redirect, notFound }));
const getServerApiClient = vi.fn();
vi.mock('../../lib/api-client/server-api-client.js', () => ({ getServerApiClient }));
vi.mock('../../lib/query-client/server-query-client.js', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return { getServerQueryClient: () => new QueryClient() };
});

const { getTicketPage } = await import('./ticket-page.js');

afterEach(() => {
  vi.clearAllMocks();
});

describe('getTicketPage', () => {
  // The schema of identifiers accepts only upper case; both shells share the redirect, so an end
  // user forwarded from `/tickets/cp-9` to the portal lands on the ticket (S1-10 QA).
  it.each([
    ['team', 'erp-12', '/tickets/ERP-12'],
    ['team', 'Erp-12', '/tickets/ERP-12'],
    ['portal', 'cp-9', '/portal/tickets/CP-9'],
    ['portal', 'Cp-9', '/portal/tickets/CP-9'],
  ] as const)(
    'redirects %s %s to the canonical %s before validating or reading it',
    async (shell, identifier, href) => {
      await expect(getTicketPage(identifier, shell)).rejects.toThrow('NEXT_REDIRECT');

      expect(redirect).toHaveBeenCalledWith(href);
      expect(notFound).not.toHaveBeenCalled();
      expect(getServerApiClient).not.toHaveBeenCalled();
    },
  );

  it('redirects to the canonical address the page gives', async () => {
    await expect(
      getTicketPage('cp-9', 'portal', (canonical) => `/portal/tickets/${canonical}/page`),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/portal/tickets/CP-9/page');
  });

  it('shows the not-found page for an identifier that is not one', async () => {
    await expect(getTicketPage('NOT_A_TICKET', 'portal')).rejects.toThrow('NEXT_NOT_FOUND');

    expect(redirect).not.toHaveBeenCalled();
    expect(getServerApiClient).not.toHaveBeenCalled();
  });
});
