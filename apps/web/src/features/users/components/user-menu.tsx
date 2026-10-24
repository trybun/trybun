'use client';

import { useQuery } from '@tanstack/react-query';
import { LOCALES, type Locale } from '@trybun/i18n/catalogues';
import { Button } from '@trybun/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@trybun/ui/components/dropdown-menu';
import { LogOutIcon, UserIcon } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { changeLanguage } from '../../../lib/i18n/change-language.js';
import { currentUserQueryOptions } from '../queries.js';

/** Initials of a name for the avatar: the first letters of its first two words. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase())
    .join('');
}

/**
 * The user menu of the header: the signed-in account, the language switch (§13.1) and the
 * sign-out. The account comes from the query prefetched by the application shell (§18.5).
 */
export function UserMenu() {
  const t = useTranslations('appShell');
  const tLanguages = useTranslations('languages');
  const locale = useLocale();
  const [, startTransition] = useTransition();
  const { data: user } = useQuery(currentUserQueryOptions(browserApiClient));
  const name = user?.displayName ?? user?.email ?? undefined;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="rounded-full" />}
        aria-label={t('accountMenu')}
        data-tour="app-header-account-menu"
      >
        {name === undefined ? (
          <UserIcon aria-hidden />
        ) : (
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {initialsOf(name)}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          {user !== undefined && (
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate text-sm text-foreground">{name}</span>
              {user.displayName !== null && user.email !== null && (
                <span className="truncate">{user.email}</span>
              )}
            </DropdownMenuLabel>
          )}
          <DropdownMenuItem onClick={() => void signOut({ callbackUrl: '/' })}>
            <LogOutIcon aria-hidden />
            {t('signOut')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('language')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={locale}
            onValueChange={(value: Locale) => {
              startTransition(() => changeLanguage(value));
            }}
          >
            {LOCALES.map((language) => (
              <DropdownMenuRadioItem key={language} value={language} lang={language}>
                {tLanguages(language)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
