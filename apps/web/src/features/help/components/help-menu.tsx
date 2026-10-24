'use client';

import { Button } from '@trybun/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from '@trybun/ui/components/dropdown-menu';
import { BookOpenIcon, CircleHelpIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { helpHref, helpPageOfPath } from '../help-routes.js';

/**
 * The help menu of the header (§2.3, §2.4): the help page of the current view – or the help index
 * for a view without one – and the items of other features, such as the product tours of the view.
 * @param views route of a view → address of its help page, for the reader's account kind
 * @param children further menu items
 */
export function HelpMenu({
  views,
  children,
}: {
  views: Readonly<Record<string, string>>;
  children?: ReactNode;
}) {
  const t = useTranslations('help');
  const pathname = usePathname();
  const page = helpPageOfPath(views, pathname);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" />}
        aria-label={t('open')}
        data-tour="app-header-help"
      >
        <CircleHelpIcon aria-hidden className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLinkItem render={<Link href={helpHref(page)} />}>
            <BookOpenIcon aria-hidden />
            {page === undefined ? t('allTopics') : t('forThisView')}
          </DropdownMenuLinkItem>
          {children}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
