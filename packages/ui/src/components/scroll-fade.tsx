'use client';

import { cn } from 'cn';
import { type ComponentProps, useEffect, useSyncExternalStore } from 'react';

/** Which sides of a horizontally scrolling element hide more of its content. */
type Overflow = 'none' | 'start' | 'end' | 'both';

/** The current item of a bar: a link of a navigation or the selected tab of a tab list. */
const CURRENT_ITEM = '[aria-current]:not([aria-current="false"]), [aria-selected="true"]';

function overflowOf(element: HTMLElement | null): Overflow {
  if (element === null) {
    return 'none';
  }
  // One pixel of tolerance for the fractional widths of zoomed pages.
  const hasStart = element.scrollLeft > 1;
  const hasEnd = element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
  return hasStart && hasEnd ? 'both' : hasStart ? 'start' : hasEnd ? 'end' : 'none';
}

/**
 * The sides of `element` that hide more content, following its scrolling, its size and the sizes
 * of its items: a label grows after a language switch or when a font loads late.
 */
function useOverflow(element: HTMLElement | null): Overflow {
  const subscribe = (onChange: () => void) => {
    if (element === null) {
      return () => undefined;
    }
    element.addEventListener('scroll', onChange, { passive: true });
    const resizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onChange);
    const observeTree = (node: Node, observe: boolean) => {
      if (!(node instanceof Element)) {
        return;
      }
      for (const item of [node, ...node.querySelectorAll('*')]) {
        if (observe) {
          resizes?.observe(item);
        } else {
          resizes?.unobserve(item);
        }
      }
    };
    observeTree(element, true);
    // Items added later are measured too (an observed element reports its first size); removed
    // ones are let go.
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => observeTree(node, true));
        record.removedNodes.forEach((node) => observeTree(node, false));
      }
    });
    mutations.observe(element, { childList: true, subtree: true });
    return () => {
      element.removeEventListener('scroll', onChange);
      resizes?.disconnect();
      mutations.disconnect();
    };
  };
  return useSyncExternalStore(
    subscribe,
    () => overflowOf(element),
    () => 'none',
  );
}

/** The width of a fade (`w-10`): a current item scrolled into view keeps clear of it. */
const FADE_WIDTH = 40;

/** Scrolls only `element`, never the page, so that its current item is in view beside the fades. */
function scrollToCurrent(element: HTMLElement) {
  const current = element.querySelector<HTMLElement>(CURRENT_ITEM);
  if (current === null) {
    return;
  }
  const start = current.offsetLeft - element.offsetLeft;
  const end = start + current.offsetWidth;
  const { scrollLeft, clientWidth, scrollWidth } = element;
  const left =
    start - FADE_WIDTH < scrollLeft
      ? Math.max(0, start - FADE_WIDTH)
      : end + FADE_WIDTH > scrollLeft + clientWidth
        ? Math.min(scrollWidth, end + FADE_WIDTH) - clientWidth
        : scrollLeft;
  if (left !== scrollLeft) {
    element.scrollTo({ left });
  }
}

/** Keeps the current item of `element` in view when it mounts and when the current item changes. */
function useCurrentInView(element: HTMLElement | null) {
  useEffect(() => {
    if (element === null) {
      return;
    }
    scrollToCurrent(element);
    const mutations = new MutationObserver(() => scrollToCurrent(element));
    mutations.observe(element, {
      attributes: true,
      attributeFilter: ['aria-current', 'aria-selected'],
      subtree: true,
    });
    return () => mutations.disconnect();
  }, [element]);
}

/**
 * Wraps a bar that scrolls sideways on a narrow screen (a navigation, a tab list): a fade on a side
 * says that more items are there (Rule 9), and the current item (`aria-current` or the selected
 * tab) is scrolled into view. `scroller` is the scrolling element among the children, passed from
 * its callback ref; it is positioned by this wrapper, so its items measure from the same parent.
 */
function ScrollFade({
  scroller,
  className,
  children,
  ...props
}: ComponentProps<'div'> & { scroller: HTMLElement | null }) {
  const overflow = useOverflow(scroller);
  useCurrentInView(scroller);

  return (
    <div data-slot="scroll-fade" className={cn('relative', className)} {...props}>
      {children}
      {(overflow === 'start' || overflow === 'both') && (
        <span
          aria-hidden
          data-slot="overflow-start"
          className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-background to-transparent"
        />
      )}
      {(overflow === 'end' || overflow === 'both') && (
        <span
          aria-hidden
          data-slot="overflow-end"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-background to-transparent"
        />
      )}
    </div>
  );
}

export { ScrollFade };
