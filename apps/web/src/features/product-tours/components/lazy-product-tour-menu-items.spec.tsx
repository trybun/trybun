// @vitest-environment jsdom
import { act, cleanup, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../../../test/dom/render.js';

vi.mock('next/navigation.js', () => ({ usePathname: () => '/' }));
// Outside the App Router of Next.js: a plain link.
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));

// The code of the tour items arrives only when the test lets it, like a slow chunk.
const chunk = vi.hoisted(() => {
  let load = () => undefined as void;
  const loaded = new Promise<void>((resolve) => {
    load = resolve;
  });
  return { loaded, load: () => load() };
});
vi.mock('./product-tour-menu-items.js', async () => {
  await chunk.loaded;
  const { DropdownMenuItem } = await import('@trybun/ui/components/dropdown-menu');
  function ProductTourMenuItems() {
    return <DropdownMenuItem>Take the tour</DropdownMenuItem>;
  }
  return { ProductTourMenuItems };
});

// The code of the help menu is loaded before the test: only the items wait for theirs.
await import('../../help/components/help-menu.js');
const { LazyHelpMenu } = await import('../../help/components/lazy-help-menu.js');
const { LazyProductTourMenuItems } = await import('./lazy-product-tour-menu-items.js');

afterEach(cleanup);

describe('LazyProductTourMenuItems', () => {
  // #184: the items suspended the boundary of the whole help menu, which hid its button.
  it('keeps the help button while the code of the items loads on the first opening', async () => {
    const user = userEvent.setup();
    renderInApp(
      <LazyHelpMenu views={{ '/': 'team/tutorials/getting-started' }}>
        <LazyProductTourMenuItems />
      </LazyHelpMenu>,
    );

    await user.click(await screen.findByRole('button', { name: 'Help' }));

    expect(await screen.findByRole('menuitem', { name: 'Help for this view' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Help' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Take the tour' })).toBeNull();

    await act(async () => {
      chunk.load();
      await chunk.loaded;
    });

    expect(await screen.findByRole('menuitem', { name: 'Take the tour' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Help' })).toBeTruthy();
  });
});
