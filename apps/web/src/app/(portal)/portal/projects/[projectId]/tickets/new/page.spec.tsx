import { afterEach, describe, expect, it, vi } from 'vitest';
import { rateLimitedResult } from '../../../../../../../../test/factories/rate-limited.factory.js';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation.js', () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock('next-intl/server', () => ({ getTranslations: () => Promise.resolve(() => '') }));
const requireSession = vi.fn();
vi.mock('../../../../../../../lib/auth/session.js', () => ({ requireSession }));
const GET = vi.fn();
vi.mock('../../../../../../../lib/api-client/server-api-client.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getServerApiClient: () => Promise.resolve({ GET }),
}));

const { default: NewTicketPage } = await import('./page.js');
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
