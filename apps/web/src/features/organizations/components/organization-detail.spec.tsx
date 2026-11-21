// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { cleanup, render, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notFoundResult } from '../../../../test/factories/not-found.factory.js';
import { BROWSER_QUERY_CLIENT_CONFIG } from '../../../lib/query-client/query-client-config.js';

vi.mock('client-only', () => ({}));
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));
const refresh = vi.hoisted(() => vi.fn());
// The router of Next.js is the same object on every render.
const router = vi.hoisted(() => ({ refresh, push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation.js', () => ({ useRouter: () => router }));
const GET = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({ browserApiClient: { GET } }));

const { OrganizationDetail } = await import('./organization-detail.js');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('OrganizationDetail of an organization that is gone', () => {
  // Deleted by another Administrator while the page was open: the server answers the refreshed
  // route with the not-found page and its translated tab title (#404).
  it('refreshes the route and shows nothing of the organization', async () => {
    GET.mockImplementation(notFoundResult);
    // The client of the application, which shows a `404` at once, without a retry.
    const client = new QueryClient(BROWSER_QUERY_CLIENT_CONFIG);

    const { container } = render(
      <NextIntlClientProvider locale="en" messages={CATALOGUES.en} timeZone="UTC">
        <QueryClientProvider client={client}>
          <OrganizationDetail organizationId="0199a3f0-0000-7000-8000-000000000020" />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    expect(container.innerHTML).toBe('');
  });
});
