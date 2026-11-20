import { CATALOGUES } from '@trybun/i18n/catalogues';
import { createTranslator } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notFoundResult } from '../../../../../../../test/factories/not-found.factory.js';
import { rateLimitedResult } from '../../../../../../../test/factories/rate-limited.factory.js';
import { ticketResponse } from '../../../../../../../test/factories/ticket.factory.js';

// The route with the shared loader of the ticket pages and the API client it reads with.
vi.mock('server-only', () => ({}));
let language: 'en' | 'pl' = 'en';
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: never) =>
    Promise.resolve(
      createTranslator({ locale: language, messages: CATALOGUES[language], namespace }),
    ),
}));
// The real loader of the ticket pages, replaceable per test for a ticket that is found.
vi.mock('../../../../../../features/tickets/ticket-page.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../../../../../features/tickets/ticket-page.js')>();
  return { ...original, getTicketPage: vi.fn(original.getTicketPage) };
});
const redirect = vi.fn((): never => {
  throw new Error('NEXT_REDIRECT');
});
vi.mock('next/navigation.js', () => ({
  redirect,
  notFound: vi.fn((): never => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
const requireSession = vi.fn();
vi.mock('../../../../../../lib/auth/session.js', () => ({ requireSession }));
const getServerApiClient = vi.fn();
vi.mock('../../../../../../lib/api-client/server-api-client.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getServerApiClient,
}));

const { getTicketPage } = await import('../../../../../../features/tickets/ticket-page.js');
const { default: ResolutionConfirmationPage, generateMetadata } = await import('./page.js');
const { RateLimitedNotice } =
  await import('../../../../../../features/app-shell/components/rate-limited-notice.js');

afterEach(() => {
  language = 'en';
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

// The not-found reaches the metadata, so the tab shows the translated not-found title after a
// client-side navigation too (#404).
describe('generateMetadata of ResolutionConfirmationPage', () => {
  it('names the ticket the end user can see', async () => {
    vi.mocked(getTicketPage).mockResolvedValueOnce(ticketResponse());

    await expect(
      generateMetadata({
        params: Promise.resolve({ identifier: 'CP-9' }),
        searchParams: Promise.resolve({ answer: 'solved' }),
      }),
    ).resolves.toEqual({
      title: { absolute: 'Resolution confirmation – ERP-12 Invoice totals are wrong – Trybun' },
    });
  });

  it('names the ticket in the language of the end user', async () => {
    language = 'pl';
    vi.mocked(getTicketPage).mockResolvedValueOnce(ticketResponse());

    await expect(
      generateMetadata({
        params: Promise.resolve({ identifier: 'CP-9' }),
        searchParams: Promise.resolve({ answer: 'solved' }),
      }),
    ).resolves.toEqual({
      title: { absolute: 'Potwierdzenie rozwiązania – ERP-12 Invoice totals are wrong – Trybun' },
    });
  });

  it('is not found for a ticket the end user cannot see', async () => {
    getServerApiClient.mockResolvedValue({ GET: notFoundResult });

    await expect(
      generateMetadata({
        params: Promise.resolve({ identifier: 'CP-9' }),
        searchParams: Promise.resolve({ answer: 'solved' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(requireSession).toHaveBeenCalledOnce();
  });

  it('names only the identifier of the address for a person over the rate limit', async () => {
    getServerApiClient.mockResolvedValue({ GET: rateLimitedResult });

    await expect(
      generateMetadata({
        params: Promise.resolve({ identifier: 'CP-9' }),
        searchParams: Promise.resolve({ answer: 'solved' }),
      }),
    ).resolves.toEqual({ title: { absolute: 'Resolution confirmation – CP-9 – Trybun' } });
  });
});
