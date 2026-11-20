import { afterEach, describe, expect, it, vi } from 'vitest';
import { rateLimitedResult } from '../../../../../../test/factories/rate-limited.factory.js';

// The route with the shared loader of the ticket pages and the API client it reads with.
vi.mock('server-only', () => ({}));
const redirect = vi.fn((): never => {
  throw new Error('NEXT_REDIRECT');
});
vi.mock('next/navigation.js', () => ({ redirect, notFound: vi.fn() }));
const requireSession = vi.fn();
vi.mock('../../../../../lib/auth/session.js', () => ({ requireSession }));
const getServerApiClient = vi.fn();
vi.mock('../../../../../lib/api-client/server-api-client.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getServerApiClient,
}));

const { default: PortalTicketPage } = await import('./page.js');
const { RateLimitedNotice } =
  await import('../../../../../features/app-shell/components/rate-limited-notice.js');

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

  it('tells a person over the rate limit when to try again (#382)', async () => {
    getServerApiClient.mockResolvedValue({ GET: rateLimitedResult });

    const element = await PortalTicketPage({ params: Promise.resolve({ identifier: 'CP-9' }) });

    expect(element).toMatchObject({
      type: RateLimitedNotice,
      props: { error: { status: 429, retryAfterSeconds: 45 } },
    });
  });
});
