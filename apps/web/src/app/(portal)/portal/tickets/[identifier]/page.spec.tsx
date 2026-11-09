import { afterEach, describe, expect, it, vi } from 'vitest';

// The route with the shared loader of the ticket pages, up to the redirect: no API call is made.
vi.mock('server-only', () => ({}));
const redirect = vi.fn((): never => {
  throw new Error('NEXT_REDIRECT');
});
vi.mock('next/navigation.js', () => ({ redirect, notFound: vi.fn() }));
const requireSession = vi.fn();
vi.mock('../../../../../lib/auth/session.js', () => ({ requireSession }));
const getServerApiClient = vi.fn();
vi.mock('../../../../../lib/api-client/server-api-client.js', () => ({ getServerApiClient }));

const { default: PortalTicketPage } = await import('./page.js');

afterEach(() => {
  vi.clearAllMocks();
});

describe('PortalTicketPage', () => {
  // An end user who opens `/tickets/cp-9` is forwarded here with the identifier as typed.
  it.each(['cp-9', 'Cp-9'])(
    'redirects %s to the canonical upper-case identifier',
    async (identifier) => {
      await expect(PortalTicketPage({ params: Promise.resolve({ identifier }) })).rejects.toThrow(
        'NEXT_REDIRECT',
      );

      expect(redirect).toHaveBeenCalledWith('/portal/tickets/CP-9');
      expect(getServerApiClient).not.toHaveBeenCalled();
    },
  );
});
