import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const requireSession = vi.fn();
vi.mock('../lib/auth/session.js', () => ({ requireSession }));

const { default: HomePage } = await import('./page.js');

describe('HomePage', () => {
  it('requires a session', async () => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });

    expect(renderToStaticMarkup(await HomePage())).toBe('<main></main>');
    expect(requireSession).toHaveBeenCalledOnce();
  });
});
