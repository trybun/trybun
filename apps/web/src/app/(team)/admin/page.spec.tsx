import { CATALOGUES } from '@trybun/i18n/catalogues';
import { createTranslator } from 'next-intl';
import type { ComponentProps, ReactElement } from 'react';
import { prerender } from 'react-dom/static';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const requireSession = vi.fn();
vi.mock('../../../lib/auth/session.js', () => ({ requireSession, getAccessToken: vi.fn() }));
const GET = vi.fn();
vi.mock('../../../lib/api-client/server-api-client.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getServerApiClient: () => Promise.resolve({ GET }),
}));
let locale: 'en' | 'pl' = 'en';
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: 'administration') =>
    Promise.resolve(createTranslator({ locale, messages: CATALOGUES[locale], namespace })),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation.js', () => ({ notFound }));
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));

const { default: GettingStartedPage } = await import('./page.js');
const { default: AboutPage } = await import('./about/page.js');

/** The HTML of a Server Component tree with async children. */
async function render(element: ReactElement): Promise<string> {
  const { prelude } = await prerender(element);
  return new Response(prelude).text();
}

function ok(data: unknown) {
  return Promise.resolve({ data, response: new Response(null, { status: 200 }) });
}

describe('Administrator panel', () => {
  beforeEach(() => {
    locale = 'en';
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });
  });

  it.each([
    ['en', '1 of 2 done', 'Configure e-mail', 'Done', 'To do'],
    ['pl', 'Ukończono 1 z 2', 'Skonfiguruj e-mail', 'Gotowe', 'Do zrobienia'],
  ] as const)(
    'shows the checklist with its state (%s)',
    async (language, progress, title, done, toDo) => {
      locale = language;
      GET.mockReturnValue(
        ok({
          items: [
            { id: 'configure_github_sign_in', isDone: false, isOptional: false },
            { id: 'configure_email', isDone: true, isOptional: false },
          ],
          nextCursor: null,
        }),
      );

      const html = await render(await GettingStartedPage());

      expect(GET).toHaveBeenCalledWith('/api/v1/administration/getting-started');
      expect(html).toContain(progress);
      expect(html).toContain(title);
      expect(html).toContain(done);
      expect(html).toContain(toDo);
      expect(html).toContain('href="/help/administrator/how-to/configure-email"');
      expect(requireSession).toHaveBeenCalledWith('/admin');
    },
  );

  it('says when every item is done', async () => {
    GET.mockReturnValue(
      ok({ items: [{ id: 'configure_email', isDone: true, isOptional: false }], nextCursor: null }),
    );

    expect(await render(await GettingStartedPage())).toContain(
      'Everything on this list is set up.',
    );
  });

  it('shows the version of /health and the license', async () => {
    GET.mockReturnValue(ok({ version: '0.4.1', license: 'MIT' }));

    const html = await render(await AboutPage());

    expect(html).toContain('0.4.1');
    expect(html).toContain('href="https://github.com/trybun/trybun/blob/v0.4.1/LICENSE"');
  });

  it('is not found for a person who is not an Administrator', async () => {
    GET.mockReturnValue(
      Promise.resolve({
        error: { type: 'about:blank', title: 'Not Found', status: 404, code: 'request.not_found' },
        response: new Response(null, { status: 404 }),
      }),
    );

    await expect(GettingStartedPage()).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(AboutPage()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
