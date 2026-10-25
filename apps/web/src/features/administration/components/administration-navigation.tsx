'use client';

import { cn } from '@trybun/ui/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation.js';
import { useTranslations } from 'next-intl';

const SECTIONS = [
  { href: '/admin', labelKey: 'gettingStarted' },
  { href: '/admin/about', labelKey: 'about' },
] as const;

/** The sections of the Administrator panel; later tasks add theirs (users, projects, settings). */
export function AdministrationNavigation() {
  const t = useTranslations('administration');
  const pathname = usePathname();
  return (
    <nav aria-label={t('sections')} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1 border-b border-border">
        {SECTIONS.map(({ href, labelKey }) => {
          const isCurrentPage = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isCurrentPage ? 'page' : undefined}
                className={cn(
                  '-mb-px flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                  isCurrentPage && 'border-primary text-foreground',
                )}
              >
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
