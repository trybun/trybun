import { afterEach, describe, expect, it, vi } from 'vitest';

// The route with the shared loader of the ticket pages, up to the redirect: no API call is made.
vi.mock('server-only', () => ({}));
const redirect = vi.fn((): never => {
  throw new Error('NEXT_REDIRECT');
});
vi.mock('next/navigation.js', () => ({ redirect, notFound: vi.fn() }));
const requireSession = vi.fn();
vi.mock('../../../../../../lib/auth/session.js', () => ({ requireSession }));
const getServerApiClient = vi.fn();
vi.mock('../../../../../../lib/api-client/server-api-client.js', () => ({ getServerApiClient }));

const { default: ResolutionConfirmationPage } = await import('./page.js');

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
});
