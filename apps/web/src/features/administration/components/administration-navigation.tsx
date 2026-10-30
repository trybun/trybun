'use client';

import { cn } from '@trybun/ui/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

const SECTIONS = [
  { href: '/admin', labelKey: 'gettingStarted' },
  { href: '/admin/accounts', labelKey: 'accounts' },
  { href: '/admin/organizations', labelKey: 'organizations' },
  { href: '/admin/about', labelKey: 'about' },
] as const;

/** Which sides of a horizontally scrolling element hide more of its content. */
type Overflow = 'none' | 'start' | 'end' | 'both';

function overflowOf(element: HTMLElement | null): Overflow {
  if (element === null) {
    return 'none';
  }
  // One pixel of tolerance for the fractional widths of zoomed pages.
  const hasStart = element.scrollLeft > 1;
  const hasEnd = element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
  return hasStart && hasEnd ? 'both' : hasStart ? 'start' : hasEnd ? 'end' : 'none';
}

/** The sides of `element` that hide more content, following its scrolling and size. */
function useOverflow(element: HTMLElement | null): Overflow {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (element === null) {
        return () => undefined;
      }
      element.addEventListener('scroll', onChange, { passive: true });
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onChange);
      observer?.observe(element);
      return () => {
        element.removeEventListener('scroll', onChange);
        observer?.disconnect();
      };
    },
    [element],
  );
  return useSyncExternalStore(
    subscribe,
    () => overflowOf(element),
    () => 'none',
  );
}

/**
 * The sections of the Administrator panel; later tasks add theirs (settings). On a narrow screen
 * the bar scrolls sideways: a fade on a side says that more sections are there (Rule 9), and the
 * current section is scrolled into view.
 */
export function AdministrationNavigation() {
  const t = useTranslations('administration');
  const pathname = usePathname();
  const [nav, setNav] = useState<HTMLElement | null>(null);
  const overflow = useOverflow(nav);

  useEffect(() => {
    nav?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [nav, pathname]);

  return (
    <div className="relative -mx-4">
      <nav ref={setNav} aria-label={t('sections')} className="overflow-x-auto px-4">
        <ul className="flex gap-1 border-b border-border">
          {SECTIONS.map(({ href, labelKey }) => {
            // A section stays marked on its nested pages, e.g. an organization.
            const isCurrentPage = pathname === href;
            const isCurrentSection =
              isCurrentPage || (href !== '/admin' && pathname.startsWith(`${href}/`));
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isCurrentPage ? 'page' : isCurrentSection ? 'true' : undefined}
                  className={cn(
                    '-mb-px flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                    isCurrentSection && 'border-primary text-foreground',
                  )}
                >
                  {t(labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
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
