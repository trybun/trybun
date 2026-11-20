import { afterEach, describe, expect, it, vi } from 'vitest';
import { rateLimitedResult } from '../../../../../../test/factories/rate-limited.factory.js';

vi.mock('server-only', () => ({}));
const notFound = vi.fn((): never => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation.js', () => ({ notFound }));
vi.mock('next-intl/server', () => ({ getTranslations: () => Promise.resolve(() => '') }));
const requireSession = vi.fn();
vi.mock('../../../../../lib/auth/session.js', () => ({ requireSession }));
const GET = vi.fn();
vi.mock('../../../../../lib/api-client/server-api-client.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getServerApiClient: () => Promise.resolve({ GET }),
}));

const { default: PortalProjectPage } = await import('./page.js');
const { RateLimitedNotice } =
  await import('../../../../../features/app-shell/components/rate-limited-notice.js');

const PROJECT_ID = '0199a3f0-0000-7000-8000-000000000010';

afterEach(() => {
  vi.clearAllMocks();
});

describe('PortalProjectPage', () => {
  it('tells a person over the rate limit when to try again (#382)', async () => {
    GET.mockImplementation(rateLimitedResult);

    const element = await PortalProjectPage({ params: Promise.resolve({ projectId: PROJECT_ID }) });

    expect(requireSession).toHaveBeenCalledOnce();
    expect(GET).toHaveBeenCalledWith(
      '/api/v1/projects/{projectId}',
      expect.objectContaining({ params: { path: { projectId: PROJECT_ID } } }),
    );
    expect(element).toMatchObject({
      type: RateLimitedNotice,
      props: { error: { status: 429, retryAfterSeconds: 45 } },
    });
  });

  it('shows the not-found page for a project the end user cannot read', async () => {
    GET.mockResolvedValue({
      error: { type: 'about:blank', title: 'Not Found', status: 404, code: 'project.not_found' },
      response: new Response(null, { status: 404 }),
    });

    await expect(
      PortalProjectPage({ params: Promise.resolve({ projectId: PROJECT_ID }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
