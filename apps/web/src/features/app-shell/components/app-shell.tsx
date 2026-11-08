import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { type NavigationContext, PORTAL_HREF } from '../navigation.js';
import { type AppHeaderSlots, AppHeader } from './app-header.js';
import { BottomNavigation } from './bottom-navigation.js';
import { SideNavigation } from './side-navigation.js';

/**
 * The application shell (§2.9), mobile-first: header and bottom navigation on phones, side
 * navigation from the tablet width on (collapsible to icons; on desktop the layout passes the
 * choice this browser remembers as `isDesktopNavigationCollapsed`). The same shell serves the team
 * and the end-user portal (§5.7); `navigation` decides which destinations it offers – the global
 * actions of a team account (`allowedActions`, §18.3), or the portal's – and the layout passes it
 * from its prefetched data, so the navigation loads no API client before the first paint.
 */
export function AppShell({
  children,
  navigation,
  isDesktopNavigationCollapsed,
  ...slots
}: AppHeaderSlots & {
  children: ReactNode;
  navigation: NavigationContext;
  isDesktopNavigationCollapsed: boolean;
}) {
  const t = useTranslations('appShell');
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-background focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        {t('skipToContent')}
      </a>
      <AppHeader {...slots} homeHref={navigation.shell === 'portal' ? PORTAL_HREF : '/'} />
      <div className="flex flex-1">
        <SideNavigation navigation={navigation} isDesktopCollapsed={isDesktopNavigationCollapsed} />
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pt-6 pb-safe-offset-20 outline-none md:px-6 md:pb-6"
        >
          {children}
        </main>
      </div>
      <BottomNavigation navigation={navigation} />
    </div>
  );
}
