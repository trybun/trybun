import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { type AppHeaderSlots, AppHeader } from './app-header.js';
import { BottomNavigation } from './bottom-navigation.js';
import { SideNavigation } from './side-navigation.js';

/**
 * The application shell (§2.9), mobile-first: header and bottom navigation on phones, side
 * navigation from the tablet width on (collapsible on tablets).
 */
export function AppShell({ children, ...slots }: AppHeaderSlots & { children: ReactNode }) {
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
        <SideNavigation />
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pt-6 pb-safe-offset-20 outline-none md:px-6 md:pb-6"
        >
          {children}
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
}
