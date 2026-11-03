'use client';

import type { CurrentUserAction } from '@trybun/contracts/users';
import { Button } from '@trybun/ui/components/button';
import { cn } from '@trybun/ui/lib/utils';
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { changeNavigationCollapsed } from '../change-navigation-collapsed.js';
import { isCurrent, navigationItemsFor } from '../navigation.js';

/**
 * The side navigation from the tablet width on (§2.9), collapsible to icons: collapsed by default
 * on tablets, expanded by default on desktop. Each breakpoint has its own state and CSS picks the
 * one that applies, so the server renders the right width at every width. The desktop choice is
 * remembered in this browser (`isDesktopCollapsed`, from the layout); the tablet state is not.
 */
export function SideNavigation({
  allowedActions,
  isDesktopCollapsed: isInitiallyDesktopCollapsed,
}: {
  allowedActions: readonly CurrentUserAction[];
  isDesktopCollapsed: boolean;
}) {
  const t = useTranslations('appShell');
  const pathname = usePathname();
  const [isTabletExpanded, setIsTabletExpanded] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(isInitiallyDesktopCollapsed);
  function toggleDesktop() {
    const isCollapsed = !isDesktopCollapsed;
    setIsDesktopCollapsed(isCollapsed);
    // Only remembers the choice; the navigation works without it.
    changeNavigationCollapsed(isCollapsed).catch(() => undefined);
  }
  return (
    <nav
      aria-label={t('mainNavigation')}
      data-tour="app-shell-navigation"
      className={cn(
        'hidden shrink-0 border-r border-border md:block',
        isTabletExpanded ? 'w-60' : 'w-16',
        isDesktopCollapsed ? 'xl:w-16' : 'xl:w-60',
      )}
    >
      <div className="sticky top-14 flex flex-col gap-1 p-2">
        <NavigationToggle
          className="xl:hidden"
          isExpanded={isTabletExpanded}
          onToggle={() => setIsTabletExpanded(!isTabletExpanded)}
        />
        <NavigationToggle
          // With a mouse the button is 32 px: the margin centres its icon on the icons of the links.
          className="hidden xl:inline-flex xl:pointer-fine:ml-1.5"
          isExpanded={!isDesktopCollapsed}
          onToggle={toggleDesktop}
        />
        <ul className="flex flex-col gap-1">
          {navigationItemsFor(allowedActions, 'wide').map(({ href, labelKey, icon }) => {
            const Icon = icon;
            const isCurrentPage = isCurrent(href, pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isCurrentPage ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none xl:pointer-fine:min-h-9',
                    isCurrentPage && 'bg-muted text-foreground',
                  )}
                >
                  <Icon aria-hidden className="size-5 shrink-0" />
                  <span
                    className={cn(
                      !isTabletExpanded && 'sr-only',
                      isDesktopCollapsed ? 'xl:sr-only' : 'xl:not-sr-only',
                    )}
                  >
                    {t(labelKey)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

/** The button that collapses or expands the side navigation at one breakpoint. */
function NavigationToggle({
  className,
  isExpanded,
  onToggle,
}: {
  className: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('appShell');
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-expanded={isExpanded}
      aria-label={isExpanded ? t('collapseNavigation') : t('expandNavigation')}
      onClick={onToggle}
    >
      {isExpanded ? <PanelLeftCloseIcon aria-hidden /> : <PanelLeftOpenIcon aria-hidden />}
    </Button>
  );
}
