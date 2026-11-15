// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../../../test/dom/render.js';

// The Server Action of the language switch reads the server environment.
vi.mock('../../../lib/i18n/change-language.js', () => ({ changeLanguage: vi.fn() }));

// The code of the menu arrives only when the test lets it, like a slow chunk.
const chunk = vi.hoisted(() => {
  let load = () => undefined as void;
  const loaded = new Promise<void>((resolve) => {
    load = resolve;
  });
  return { loaded, load: () => load() };
});
vi.mock('./user-menu.js', async (importOriginal) => {
  await chunk.loaded;
  return importOriginal();
});

const { LazyUserMenu } = await import('./lazy-user-menu.js');

afterEach(cleanup);

describe('LazyUserMenu', () => {
  // #311: React drops the server HTML of a boundary that is updated before its code has loaded;
  // with an empty fallback the button vanished, the header items moved and the tours lost it.
  it('shows the same account button while the code of the menu loads', async () => {
    // The account the layout prefetched, which the menu reads from the query cache.
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    client.setQueryData(['users', 'me'], {
      id: '0199a3f0-0000-7000-8000-000000000003',
      displayName: 'Dorota Developer',
      email: 'developer@example.com',
      kind: 'team',
      allowedActions: [],
    });
    renderInApp(<LazyUserMenu accountName="Dorota Developer" />, { client });

    const placeholder = screen.getByRole('button', { name: 'Account menu' });
    const { className, innerHTML } = placeholder;
    expect(placeholder.getAttribute('data-tour')).toBe('app-header-account-menu');
    expect(placeholder.textContent).toBe('DD');

    // Wait for the module itself, not a wall-clock budget (#326).
    await act(async () => {
      chunk.load();
      await import('./user-menu.js');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Account menu' })).not.toBe(placeholder);
    });
    const trigger = screen.getByRole('button', { name: 'Account menu' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('data-tour')).toBe('app-header-account-menu');
    expect(trigger.className).toBe(className);
    expect(trigger.innerHTML).toBe(innerHTML);
  });
});
