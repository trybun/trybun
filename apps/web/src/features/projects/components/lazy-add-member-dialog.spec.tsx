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
vi.mock('./add-member-dialog.js', async (importOriginal) => {
  await chunk.loaded;
  return importOriginal();
});

const { LazyAddMemberDialog } = await import('./lazy-add-member-dialog.js');

afterEach(cleanup);

describe('LazyAddMemberDialog', () => {
  // #308: React drops the server HTML of a boundary that is updated before its code has loaded;
  // with an empty fallback the button vanished and the content below it moved under the finger.
  it('shows the same Add member button while the code of the dialog loads', async () => {
    renderInApp(<LazyAddMemberDialog projectId="019b8d00-0000-7000-8000-000000000001" />);

    const placeholder = screen.getByRole('button', { name: 'Add member' });
    const { className, innerHTML } = placeholder;

    await act(async () => {
      chunk.load();
      await chunk.loaded;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add member' })).not.toBe(placeholder);
    });
    const trigger = screen.getByRole('button', { name: 'Add member' });
    expect(trigger.className).toBe(className);
    expect(trigger.innerHTML).toBe(innerHTML);
  });
});
