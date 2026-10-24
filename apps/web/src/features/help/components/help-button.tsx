'use client';

import { buttonVariants } from '@trybun/ui/components/button';
import { CircleHelpIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { helpHref, helpPageOfPath } from '../help-routes.js';

/**
 * The help icon of the header (§2.3): opens the help page of the current view, or the help index
 * for a view without one.
 * @param views route of a view → address of its help page, for the reader's account kind
 */
export function HelpButton({ views }: { views: Readonly<Record<string, string>> }) {
  const t = useTranslations('help');
  const pathname = usePathname();
  return (
    <Link
      href={helpHref(helpPageOfPath(views, pathname))}
      aria-label={t('open')}
      className={buttonVariants({ variant: 'ghost', size: 'icon' })}
    >
      <CircleHelpIcon aria-hidden className="size-5" />
    </Link>
  );
}
