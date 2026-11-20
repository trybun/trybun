import { CATALOGUES } from '@trybun/i18n/catalogues';
import { createTranslator } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notFoundResult } from '../../../../../../test/factories/not-found.factory.js';
import { rateLimitedResult } from '../../../../../../test/factories/rate-limited.factory.js';

vi.mock('server-only', () => ({}));
let language: 'en' | 'pl' = 'en';
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: never) =>
    Promise.resolve(
      createTranslator({ locale: language, messages: CATALOGUES[language], namespace }),
    ),
}));
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

const { default: ProjectSettingsPage, generateMetadata } = await import('./page.js');
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
  language = 'en';
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

// The not-found reaches the metadata, so the tab shows the translated not-found title after a
// client-side navigation too (#404).
describe('generateMetadata of the project settings', () => {
  it('names the view and then the project in the tab', async () => {
    GET.mockResolvedValue({ data: { id: PROJECT_ID, name: 'Website' }, response: new Response() });

    await expect(
      generateMetadata({ params: Promise.resolve({ projectId: PROJECT_ID }) }),
    ).resolves.toEqual({ title: { absolute: 'Project settings – Website – Trybun' } });
  });

  it('names the view in the language of the person', async () => {
    language = 'pl';
    GET.mockResolvedValue({ data: { id: PROJECT_ID, name: 'Website' }, response: new Response() });

    await expect(
      generateMetadata({ params: Promise.resolve({ projectId: PROJECT_ID }) }),
    ).resolves.toEqual({ title: { absolute: 'Ustawienia projektu – Website – Trybun' } });
  });

  it('is not found for a project the person cannot see', async () => {
    GET.mockImplementation(notFoundResult);

    await expect(
      generateMetadata({ params: Promise.resolve({ projectId: PROJECT_ID }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(requireSession).toHaveBeenCalledOnce();
  });

  it('is not found for an address that is not a project ID, without reading', async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ projectId: 'no-project' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(GET).not.toHaveBeenCalled();
  });

  it('names only the view for a person over the rate limit', async () => {
    GET.mockImplementation(rateLimitedResult);

    await expect(
      generateMetadata({ params: Promise.resolve({ projectId: PROJECT_ID }) }),
    ).resolves.toEqual({ title: { absolute: 'Project settings – Trybun' } });
  });
});
