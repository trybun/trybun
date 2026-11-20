import { afterEach, describe, expect, it, vi } from 'vitest';
import { notFoundResult } from '../../../../../../test/factories/not-found.factory.js';
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

const { default: PortalProjectPage, generateMetadata } = await import('./page.js');
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

// The not-found reaches the metadata, so the tab shows the translated not-found title after a
// client-side navigation too (#404).
describe('generateMetadata of the project home', () => {
  it('reads the project as the page does and keeps the metadata of the layouts', async () => {
    GET.mockResolvedValue({ data: { id: PROJECT_ID }, response: new Response() });

    await expect(
      generateMetadata({ params: Promise.resolve({ projectId: PROJECT_ID }) }),
    ).resolves.toEqual({});
    expect(requireSession).toHaveBeenCalledOnce();
    expect(GET).toHaveBeenCalledWith(
      '/api/v1/projects/{projectId}',
      expect.objectContaining({ params: { path: { projectId: PROJECT_ID } } }),
    );
  });

  it('is not found for a project the end user cannot read', async () => {
    GET.mockImplementation(notFoundResult);

    await expect(
      generateMetadata({ params: Promise.resolve({ projectId: PROJECT_ID }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('is not found for an address that is not a project ID, without reading', async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ projectId: 'no-project' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(GET).not.toHaveBeenCalled();
  });

  it('keeps the metadata of the layouts for a person over the rate limit', async () => {
    GET.mockImplementation(rateLimitedResult);

    await expect(
      generateMetadata({ params: Promise.resolve({ projectId: PROJECT_ID }) }),
    ).resolves.toEqual({});
  });
});
