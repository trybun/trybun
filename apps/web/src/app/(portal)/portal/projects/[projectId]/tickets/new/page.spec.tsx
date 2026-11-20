import { CATALOGUES } from '@trybun/i18n/catalogues';
import { createTranslator } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notFoundResult } from '../../../../../../../../test/factories/not-found.factory.js';
import { rateLimitedResult } from '../../../../../../../../test/factories/rate-limited.factory.js';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation.js', () => ({
  notFound: vi.fn((): never => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn(),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: never) =>
    Promise.resolve(createTranslator({ locale: 'en', messages: CATALOGUES.en, namespace })),
}));
const requireSession = vi.fn();
vi.mock('../../../../../../../lib/auth/session.js', () => ({ requireSession }));
const GET = vi.fn();
vi.mock('../../../../../../../lib/api-client/server-api-client.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getServerApiClient: () => Promise.resolve({ GET }),
}));

const { default: NewTicketPage, generateMetadata } = await import('./page.js');
const { RateLimitedNotice } =
  await import('../../../../../../../features/app-shell/components/rate-limited-notice.js');

const PROJECT_ID = '0199a3f0-0000-7000-8000-000000000010';

afterEach(() => {
  vi.clearAllMocks();
});

describe('NewTicketPage of the portal', () => {
  it('tells a person over the rate limit when to try again (#382)', async () => {
    GET.mockImplementation(rateLimitedResult);

    const element = await NewTicketPage({ params: Promise.resolve({ projectId: PROJECT_ID }) });

    expect(requireSession).toHaveBeenCalledOnce();
    expect(element).toMatchObject({
      type: RateLimitedNotice,
      props: { error: { status: 429, retryAfterSeconds: 45 } },
    });
  });
});

// The not-found reaches the metadata, so the tab shows the translated not-found title after a
// client-side navigation too (#404).
describe('generateMetadata of the new ticket page', () => {
  it('names the view and then the project in the tab', async () => {
    GET.mockResolvedValue({ data: { id: PROJECT_ID, name: 'Website' }, response: new Response() });

    await expect(
      generateMetadata({ params: Promise.resolve({ projectId: PROJECT_ID }) }),
    ).resolves.toEqual({ title: { absolute: 'New ticket – Website – Trybun' } });
  });

  it('is not found for a project the end user cannot read', async () => {
    GET.mockImplementation(notFoundResult);

    await expect(
      generateMetadata({ params: Promise.resolve({ projectId: PROJECT_ID }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(requireSession).toHaveBeenCalledOnce();
  });

  it('names the page without the project for a person over the rate limit', async () => {
    GET.mockImplementation(rateLimitedResult);

    await expect(
      generateMetadata({ params: Promise.resolve({ projectId: PROJECT_ID }) }),
    ).resolves.toEqual({ title: { absolute: 'New ticket – Trybun' } });
  });
});
