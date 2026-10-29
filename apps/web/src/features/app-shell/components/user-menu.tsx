'use client';

import { useQuery } from '@tanstack/react-query';
import { LOCALES, type Locale } from '@trybun/i18n/catalogues';
import { Button } from '@trybun/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@trybun/ui/components/dropdown-menu';
import { LogOutIcon, SettingsIcon, UserCogIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { changeLanguage } from '../../../lib/i18n/change-language.js';
import { useUpdateCurrentUser } from '../../users/mutations.js';
import { currentUserQueryOptions } from '../../users/queries.js';
import { SETTINGS_HREF } from '../../users/search-params.js';

/** Initials of a name for the avatar: the first letters of its first two words. */
/**
 * Signs out through Auth.js, which is loaded only then: every byte the shell requests before its
 * first paint counts towards the simulated LCP of §2.9 (#72).
 */
async function signOutOfSession(): Promise<void> {
  const { signOut } = await import('next-auth/react');
  await signOut({ callbackUrl: '/' });
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase())
    .join('');
}

/**
 * The user menu of the header: the signed-in account, its Account settings, the Administrator
 * panel for Administrators, the language switch (§13.1) and the sign-out. The account comes from
 * the query prefetched by the application shell (§18.5). The language switch also saves the
 * language of the account, so the next sign-in on another device uses it.
 */
export function UserMenu() {
  const t = useTranslations('appShell');
  const tLanguages = useTranslations('languages');
  const locale = useLocale();
  const [, startTransition] = useTransition();
  const { data: user } = useQuery(currentUserQueryOptions(browserApiClient));
  const updateCurrentUser = useUpdateCurrentUser();
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
          <DropdownMenuLinkItem render={<Link href={SETTINGS_HREF} />}>
            <UserCogIcon aria-hidden />
            {t('accountSettings')}
          </DropdownMenuLinkItem>
          {user?.allowedActions.includes('open_administration') === true && (
            // The way to the Administrator panel on phones, whose bottom navigation leaves it out.
            <DropdownMenuLinkItem render={<Link href="/admin" />}>
              <SettingsIcon aria-hidden />
              {t('administration')}
            </DropdownMenuLinkItem>
          )}
          <DropdownMenuItem onClick={() => void signOutOfSession()}>
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
              // This device switches also when the account cannot be saved, e.g. offline.
              updateCurrentUser.mutate(
                { language: value },
                { onSettled: () => startTransition(() => changeLanguage(value)) },
              );
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
