// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../../../test/dom/render.js';

const pathname = vi.hoisted(() => ({ current: '/admin' }));
vi.mock('next/navigation.js', () => ({ usePathname: () => pathname.current }));

const { AdministrationNavigation } = await import('./administration-navigation.js');

/** jsdom lays nothing out: the sizes of a bar 360 px wide whose sections are 500 px wide. */
function layOut(nav: HTMLElement, scrollLeft: number) {
  Object.defineProperties(nav, {
    clientWidth: { configurable: true, value: 360 },
    scrollWidth: { configurable: true, value: 500 },
    scrollLeft: { configurable: true, value: scrollLeft, writable: true },
  });
}

// jsdom has no scrollIntoView.
const scrollIntoView = vi.fn();
beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterEach(() => {
  cleanup();
  pathname.current = '/admin';
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});

describe('AdministrationNavigation', () => {
  it('marks the current section and links all sections', () => {
    pathname.current = '/admin/organizations/0199a3f0-0000-7000-8000-000000000020';
    renderInApp(<AdministrationNavigation />);

    expect(screen.getByRole('link', { name: 'Organizations' }).getAttribute('aria-current')).toBe(
      'true',
    );
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });

  // On a phone the bar scrolls sideways; the fade says which side hides more sections (Rule 9).
  it('fades the side of the bar that hides more sections while it scrolls', () => {
    const { container } = renderInApp(<AdministrationNavigation />);
    const nav = screen.getByRole('navigation');
    const fade = (side: 'start' | 'end') =>
      container.querySelector(`[data-slot="overflow-${side}"]`);

    expect(fade('end')).toBeNull();

    layOut(nav, 0);
    act(() => void fireEvent.scroll(nav));
    expect(fade('start')).toBeNull();
    expect(fade('end')).not.toBeNull();

    layOut(nav, 70);
    act(() => void fireEvent.scroll(nav));
    expect(fade('start')).not.toBeNull();
    expect(fade('end')).not.toBeNull();

    layOut(nav, 140);
    act(() => void fireEvent.scroll(nav));
    expect(fade('start')).not.toBeNull();
    expect(fade('end')).toBeNull();
  });

  it('scrolls the current section into view', () => {
    pathname.current = '/admin/about';
    renderInApp(<AdministrationNavigation />);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('link', { name: 'About' }));
  });
});
