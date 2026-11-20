// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { cleanup, render, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notFoundResult } from '../../../../test/factories/not-found.factory.js';

vi.mock('client-only', () => ({}));
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));
const refresh = vi.hoisted(() => vi.fn());
// The router of Next.js is the same object on every render.
const router = vi.hoisted(() => ({ refresh, push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation.js', () => ({ useRouter: () => router }));
const GET = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({ browserApiClient: { GET } }));

const { ProjectSettings } = await import('./project-settings.js');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProjectSettings of a project that is gone', () => {
  // Invisible since the page was opened, e.g. a Project manager removed themselves from it: the
  // server answers the refreshed route with the not-found page and its translated tab title (#404).
  it('refreshes the route and shows nothing of the project', async () => {
    GET.mockImplementation(notFoundResult);
    const client = new QueryClient();

    const { container } = render(
      <NextIntlClientProvider locale="en" messages={CATALOGUES.en} timeZone="UTC">
        <QueryClientProvider client={client}>
          <ProjectSettings projectId="0199a3f0-0000-7000-8000-000000000010" tab="general" />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    expect(container.innerHTML).toBe('');
  });
});
