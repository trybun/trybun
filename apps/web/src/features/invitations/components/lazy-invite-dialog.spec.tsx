// @vitest-environment jsdom
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../../../test/dom/render.js';

vi.mock('next/navigation.js', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// The code of the dialog arrives only when the test lets it, like a slow chunk.
const chunk = vi.hoisted(() => {
  let load = () => undefined as void;
  const loaded = new Promise<void>((resolve) => {
    load = resolve;
  });
  return { loaded, load: () => load() };
});
vi.mock('./invite-dialog.js', async (importOriginal) => {
  await chunk.loaded;
  return importOriginal();
});

const { LazyInviteDialog } = await import('./lazy-invite-dialog.js');

afterEach(cleanup);

describe('LazyInviteDialog', () => {
  // #308: React drops the server HTML of a boundary that is updated before its code has loaded;
  // with an empty fallback the button vanished and the content below it moved under the finger.
  it('shows the same Invite buttons while the code of the dialog loads', async () => {
    renderInApp(
      <>
        <LazyInviteDialog />
        <LazyInviteDialog email="ada@example.org" kind="team" />
      </>,
    );

    const names = ['Invite', 'Invite ada@example.org'];
    const placeholders = names.map((name) => screen.getByRole('button', { name }));
    const shapes = placeholders.map(({ className, innerHTML }) => ({ className, innerHTML }));

    // Wait for the module itself, not a wall-clock budget: under load its transform can take longer
    // than the timeout of waitFor (#326).
    await act(async () => {
      chunk.load();
      await import('./invite-dialog.js');
    });

    await waitFor(() => {
      for (const [index, name] of names.entries()) {
        expect(screen.getByRole('button', { name })).not.toBe(placeholders[index]);
      }
    });
    for (const [index, name] of names.entries()) {
      const { className, innerHTML } = screen.getByRole('button', { name });
      expect({ className, innerHTML }).toEqual(shapes[index]);
    }
  });
});
