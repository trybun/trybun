'use client';

import { ScrollFade } from '@trybun/ui/components/scroll-fade';
import { cn } from '@trybun/ui/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const SECTIONS = [
  { href: '/admin', labelKey: 'gettingStarted' },
  { href: '/admin/accounts', labelKey: 'accounts' },
  { href: '/admin/organizations', labelKey: 'organizations' },
  { href: '/admin/about', labelKey: 'about' },
] as const;

/**
 * The sections of the Administrator panel; later tasks add theirs (settings). On a narrow screen
 * the bar scrolls sideways in a `ScrollFade`: a fade on a side says that more sections are there
 * (Rule 9), and the current section is scrolled into view.
 */
export function AdministrationNavigation() {
  const t = useTranslations('administration');
  const pathname = usePathname();
  const [nav, setNav] = useState<HTMLElement | null>(null);

  return (
    <ScrollFade scroller={nav} className="-mx-4">
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
    </ScrollFade>
  );
}
