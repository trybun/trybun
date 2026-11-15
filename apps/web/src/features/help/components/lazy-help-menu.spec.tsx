// @vitest-environment jsdom
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../../../test/dom/render.js';

vi.mock('next/navigation.js', () => ({ usePathname: () => '/' }));

// The code of the menu arrives only when the test lets it, like a slow chunk.
const chunk = vi.hoisted(() => {
  let load = () => undefined as void;
  const loaded = new Promise<void>((resolve) => {
    load = resolve;
  });
  return { loaded, load: () => load() };
});
vi.mock('./help-menu.js', async (importOriginal) => {
  await chunk.loaded;
  return importOriginal();
});

const { LazyHelpMenu } = await import('./lazy-help-menu.js');

afterEach(cleanup);

describe('LazyHelpMenu', () => {
  // #311: React drops the server HTML of a boundary that is updated before its code has loaded;
  // with an empty fallback the button vanished, the header items moved and the tours lost it.
  it('shows the same Help button while the code of the menu loads', async () => {
    renderInApp(<LazyHelpMenu views={{ '/': 'team/tutorials/getting-started' }} />);

    const placeholder = screen.getByRole('button', { name: 'Help' });
    const { className, innerHTML } = placeholder;
    expect(placeholder.getAttribute('data-tour')).toBe('app-header-help');

    // Wait for the module itself, not a wall-clock budget (#326).
    await act(async () => {
      chunk.load();
      await import('./help-menu.js');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Help' })).not.toBe(placeholder);
    });
    const trigger = screen.getByRole('button', { name: 'Help' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('data-tour')).toBe('app-header-help');
    expect(trigger.className).toBe(className);
    expect(trigger.innerHTML).toBe(innerHTML);
  });
});
