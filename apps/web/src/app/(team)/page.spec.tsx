import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const requireSession = vi.fn();
vi.mock('../../lib/auth/session.js', () => ({ requireSession }));
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: string) => Promise.resolve((key: string) => `${namespace}.${key}`),
}));

const { default: HomePage } = await import('./page.js');

describe('HomePage', () => {
  it('requires a session', async () => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });

    expect(renderToStaticMarkup(await HomePage())).toBe(
      '<h1 class="text-2xl font-bold">home.title</h1>',
    );
    expect(requireSession).toHaveBeenCalledOnce();
  });
});
