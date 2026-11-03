// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../../../test/dom/render.js';

vi.mock('next/navigation.js', () => ({ usePathname: () => '/' }));
// Outside the App Router of Next.js: a plain link.
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));
vi.mock('../change-navigation-collapsed.js', () => ({ changeNavigationCollapsed: vi.fn() }));

const { SideNavigation } = await import('./side-navigation.js');

/** A window as wide as a tablet, or as a desktop when `isDesktop` (jsdom has no `matchMedia`). */
function stubWidth(isDesktop: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isDesktop && query === '(min-width: 80rem)',
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

/** The tooltip of the side navigation, not the `sr-only` label of the link. */
function findTooltip(name: string) {
  return screen.findByText(name, { selector: '[data-slot=tooltip-content]' });
}

/** Tabs to the link: jsdom applies no CSS, so both toggles (tablet and desktop) are focusable. */
async function tabTo(user: ReturnType<typeof userEvent.setup>, name: string) {
  const link = screen.getByRole('link', { name });
  for (let index = 0; index < 5 && document.activeElement !== link; index += 1) {
    await user.tab();
  }
  expect(document.activeElement).toBe(link);
  return link;
}

function queryTooltip() {
  return document.querySelector('[data-slot=tooltip-content]');
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SideNavigation', () => {
  it('shows the name of a collapsed icon on keyboard focus and keeps the name of the link', async () => {
    stubWidth(false);
    const user = userEvent.setup();
    renderInApp(<SideNavigation allowedActions={[]} isDesktopCollapsed={false} />);

    const link = await tabTo(user, 'Home');
    expect(await findTooltip('Home')).toBeTruthy();
    expect(link.getAttribute('aria-describedby')).toBeNull();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(queryTooltip()).toBeNull());
  });

  it('shows the translated name in Polish', async () => {
    stubWidth(false);
    const user = userEvent.setup();
    renderInApp(<SideNavigation allowedActions={[]} isDesktopCollapsed={false} />, {
      locale: 'pl',
    });

    await tabTo(user, 'Strona główna');

    expect(await findTooltip('Strona główna')).toBeTruthy();
  });

  it('shows no tooltip once the tablet navigation is expanded', async () => {
    stubWidth(false);
    const user = userEvent.setup();
    renderInApp(<SideNavigation allowedActions={[]} isDesktopCollapsed={false} />);

    await user.click(screen.getByRole('button', { name: 'Expand navigation' }));
    await tabTo(user, 'Home');

    expect(queryTooltip()).toBeNull();
  });

  it.each([
    { isDesktopCollapsed: true, hasTooltip: true },
    { isDesktopCollapsed: false, hasTooltip: false },
  ])(
    'on desktop follows the desktop state (collapsed: $isDesktopCollapsed)',
    async ({ isDesktopCollapsed, hasTooltip }) => {
      stubWidth(true);
      const user = userEvent.setup();
      renderInApp(<SideNavigation allowedActions={[]} isDesktopCollapsed={isDesktopCollapsed} />);

      await tabTo(user, 'Home');

      if (hasTooltip) {
        expect(await findTooltip('Home')).toBeTruthy();
      } else {
        expect(queryTooltip()).toBeNull();
      }
    },
  );
});
