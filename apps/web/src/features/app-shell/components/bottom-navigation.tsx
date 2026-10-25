'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@trybun/ui/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { currentUserQueryOptions } from '../../users/queries.js';
import { isCurrent, navigationItemsFor } from '../navigation.js';

/** The bottom navigation of phones (§2.9), above the home indicator. */
export function BottomNavigation() {
  const t = useTranslations('appShell');
  const pathname = usePathname();
  const { data: user } = useQuery(currentUserQueryOptions(browserApiClient));
  return (
    <nav
      aria-label={t('mainNavigation')}
      data-tour="app-shell-navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-safe-offset-0 md:hidden"
    >
      <ul className="flex">
        {navigationItemsFor(user?.allowedActions, 'phone').map(({ href, labelKey, icon }) => {
          const Icon = icon;
          const isCurrentPage = isCurrent(href, pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isCurrentPage ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                  isCurrentPage && 'text-foreground',
                )}
              >
                <Icon aria-hidden className="size-6" />
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
