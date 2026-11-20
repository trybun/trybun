import { afterEach, describe, expect, it, vi } from 'vitest';
import { rateLimitedResult } from '../../../../../../../test/factories/rate-limited.factory.js';

// The route with the shared loader of the ticket pages and the API client it reads with.
vi.mock('server-only', () => ({}));
const redirect = vi.fn((): never => {
  throw new Error('NEXT_REDIRECT');
});
vi.mock('next/navigation.js', () => ({ redirect, notFound: vi.fn() }));
const requireSession = vi.fn();
vi.mock('../../../../../../lib/auth/session.js', () => ({ requireSession }));
const getServerApiClient = vi.fn();
vi.mock('../../../../../../lib/api-client/server-api-client.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getServerApiClient,
}));

const { default: ResolutionConfirmationPage } = await import('./page.js');
const { RateLimitedNotice } =
  await import('../../../../../../features/app-shell/components/rate-limited-notice.js');

afterEach(() => {
  vi.clearAllMocks();
});

describe('ResolutionConfirmationPage', () => {
  it.each([
    [{ answer: 'solved' }, '/portal/tickets/CP-9/resolution-confirmation?answer=solved'],
    [{ answer: 'not_solved' }, '/portal/tickets/CP-9/resolution-confirmation?answer=not_solved'],
    [{}, '/portal/tickets/CP-9'],
  ])(
    'redirects a lower-case identifier to upper case, keeping the answer %j',
    async (searchParams, href) => {
      await expect(
        ResolutionConfirmationPage({
          params: Promise.resolve({ identifier: 'cp-9' }),
          searchParams: Promise.resolve(searchParams),
        }),
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(redirect).toHaveBeenCalledWith(href);
      expect(getServerApiClient).not.toHaveBeenCalled();
    },
  );

  it('tells a person over the rate limit when to try again (#382)', async () => {
    getServerApiClient.mockResolvedValue({ GET: rateLimitedResult });

    const element = await ResolutionConfirmationPage({
      params: Promise.resolve({ identifier: 'CP-9' }),
      searchParams: Promise.resolve({ answer: 'solved' }),
    });

    expect(element).toMatchObject({
      type: RateLimitedNotice,
      props: { error: { status: 429, retryAfterSeconds: 45 } },
    });
  });
});
