import type { CurrentUserAction } from '@trybun/contracts/users';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { type AppHeaderSlots, AppHeader } from './app-header.js';
import { BottomNavigation } from './bottom-navigation.js';
import { SideNavigation } from './side-navigation.js';

/**
 * The application shell (§2.9), mobile-first: header and bottom navigation on phones, side
 * navigation from the tablet width on (collapsible on tablets). The global actions of the account
 * (`allowedActions`, §18.3) decide which destinations the navigation offers; the layout passes
 * them from its prefetched account, so the navigation loads no API client before the first paint.
 */
export function AppShell({
  children,
  allowedActions,
  ...slots
}: AppHeaderSlots & { children: ReactNode; allowedActions: readonly CurrentUserAction[] }) {
  const t = useTranslations('appShell');
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-3 focus:ring-ring"
      >
        {t('skipToContent')}
      </a>
      <AppHeader {...slots} />
      <div className="flex flex-1">
        <SideNavigation allowedActions={allowedActions} />
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pt-6 pb-safe-offset-20 outline-none md:px-6 md:pb-6"
        >
          {children}
        </main>
      </div>
      <BottomNavigation allowedActions={allowedActions} />
    </div>
  );
}
