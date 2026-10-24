import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { UserMenu } from '../../users/components/user-menu.js';

export interface AppHeaderSlots {
  /** The search button that opens the command palette (§8.4, S2-05). */
  search?: ReactNode;
  /** The help icon that opens the help page of the current view (§2.3, S0-09). */
  help?: ReactNode;
  /** The notification bell (§6.6). */
  notifications?: ReactNode;
}

/** The header of the application shell: brand, the slots of the header actions and the user menu. */
export function AppHeader({ search, help, notifications }: AppHeaderSlots) {
  const t = useTranslations('app');
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-1 border-b border-border bg-background px-2 md:px-4">
      <Link
        href="/"
        className="flex min-h-11 items-center gap-2 rounded-lg px-1 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Image src="/icons/trybun-icon.svg" alt="" width={32} height={32} unoptimized priority />
        <span className="sr-only text-lg font-extrabold lowercase md:not-sr-only">
          {t('title')}
        </span>
      </Link>
      <div className="ml-auto flex items-center gap-1">
        {search}
        {help}
        {notifications}
        <UserMenu />
      </div>
    </header>
  );
}
