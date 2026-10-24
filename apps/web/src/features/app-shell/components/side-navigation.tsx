'use client';

import { Button } from '@trybun/ui/components/button';
import { cn } from '@trybun/ui/lib/utils';
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { isCurrent, NAVIGATION_ITEMS } from '../navigation.js';

/**
 * The side navigation from the tablet width on (§2.9): collapsible to icons on tablets, always
 * expanded on desktop.
 */
export function SideNavigation() {
  const t = useTranslations('appShell');
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <nav
      aria-label={t('mainNavigation')}
      data-tour="app-shell-navigation"
      className={cn(
        'hidden shrink-0 border-r border-border md:block xl:w-60',
        isExpanded ? 'w-60' : 'w-16',
      )}
    >
      <div className="sticky top-14 flex flex-col gap-1 p-2">
        <Button
          variant="ghost"
          size="icon"
          className="xl:hidden"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? t('collapseNavigation') : t('expandNavigation')}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <PanelLeftCloseIcon aria-hidden /> : <PanelLeftOpenIcon aria-hidden />}
        </Button>
        <ul className="flex flex-col gap-1">
          {NAVIGATION_ITEMS.map(({ href, labelKey, icon }) => {
            const Icon = icon;
            const isCurrentPage = isCurrent(href, pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isCurrentPage ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none xl:pointer-fine:min-h-9',
                    isCurrentPage && 'bg-muted text-foreground',
                  )}
                >
                  <Icon aria-hidden className="size-5 shrink-0" />
                  <span className={cn(!isExpanded && 'sr-only xl:not-sr-only')}>{t(labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
