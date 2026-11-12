// @vitest-environment jsdom
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../../../test/dom/render.js';

vi.mock('next/navigation.js', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// The code of the dialog arrives only when the test lets it, like a slow chunk.
const chunk = vi.hoisted(() => {
  let load = () => undefined as void;
  const loaded = new Promise<void>((resolve) => {
    load = resolve;
  });
  return { loaded, load: () => load() };
});
vi.mock('./new-organization-dialog.js', async (importOriginal) => {
  await chunk.loaded;
  return importOriginal();
});

const { LazyNewOrganizationDialog } = await import('./lazy-new-organization-dialog.js');

afterEach(cleanup);

describe('LazyNewOrganizationDialog', () => {
  // #308: React drops the server HTML of a boundary that is updated before its code has loaded;
  // with an empty fallback the button vanished and the list below it moved under the finger.
  it('shows the same New organization button while the code of the dialog loads', async () => {
    renderInApp(<LazyNewOrganizationDialog />);

    const placeholder = screen.getByRole('button', { name: 'New organization' });
    const { className, innerHTML } = placeholder;

    // Wait for the module itself, not a wall-clock budget: under load its transform can take longer
    // than the timeout of waitFor (#326).
    await act(async () => {
      chunk.load();
      await import('./new-organization-dialog.js');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New organization' })).not.toBe(placeholder);
    });
    const trigger = screen.getByRole('button', { name: 'New organization' });
    expect(trigger.className).toBe(className);
    expect(trigger.innerHTML).toBe(innerHTML);
  });
});
