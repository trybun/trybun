import { afterEach, describe, expect, it, vi } from 'vitest';
import { rateLimitedResult } from '../../../../../../test/factories/rate-limited.factory.js';

vi.mock('server-only', () => ({}));
const notFound = vi.fn((): never => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation.js', () => ({ notFound }));
const requireSession = vi.fn();
vi.mock('../../../../../lib/auth/session.js', () => ({ requireSession }));
const GET = vi.fn();
vi.mock('../../../../../lib/api-client/server-api-client.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getServerApiClient: () => Promise.resolve({ GET }),
}));

const { default: ProjectSettingsPage } = await import('./page.js');
const { RateLimitedNotice } =
  await import('../../../../../features/app-shell/components/rate-limited-notice.js');

const PROJECT_ID = '0199a3f0-0000-7000-8000-000000000010';

function render() {
  return ProjectSettingsPage({
    params: Promise.resolve({ projectId: PROJECT_ID }),
    searchParams: Promise.resolve({}),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('ProjectSettingsPage', () => {
  it('tells a person over the rate limit when to try again (#382)', async () => {
    GET.mockImplementation(rateLimitedResult);

    const element = await render();

    expect(requireSession).toHaveBeenCalledOnce();
    expect(GET).toHaveBeenCalledOnce();
    expect(element).toMatchObject({
      type: RateLimitedNotice,
      props: { error: { status: 429, retryAfterSeconds: 45 } },
    });
  });

  it('shows the not-found page for a project the person cannot see', async () => {
    GET.mockResolvedValue({
      error: { type: 'about:blank', title: 'Not Found', status: 404, code: 'project.not_found' },
      response: new Response(null, { status: 404 }),
    });

    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
