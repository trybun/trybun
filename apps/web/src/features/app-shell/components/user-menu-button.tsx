import { Button } from '@trybun/ui/components/button';
import { UserIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentProps } from 'react';

/**
 * The name of an account in its user menu: the display name, else the address. The layout passes
 * it to the button before the menu's code loads, and the menu reads it from the query – one
 * function, so both show the same initials.
 */
export function accountNameOf(
  account: { displayName: string | null; email: string | null } | undefined,
): string | undefined {
  return account?.displayName ?? account?.email ?? undefined;
}

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
 * The button of the user menu: the initials of the signed-in account, or a person icon while its
 * name is unknown. It is the trigger of `UserMenu`, and the fallback of `LazyUserMenu` while the
 * menu's code loads, so both take the same place in the header (#311). A module of its own
 * without Base UI's `Menu` and the API client, which load after the first paint (#72).
 * @param name the display name or address of the account
 * @param props the props of the menu trigger, which renders this button
 */
export function UserMenuButton({
  name,
  ...props
}: Omit<ComponentProps<typeof Button>, 'children'> & { name: string | undefined }) {
  const t = useTranslations('appShell');
  return (
    <Button
      variant="ghost"
      size="icon"
      // The initials fill the button on desktop; the offset keeps the focus ring apart from them.
      className="rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={t('accountMenu')}
      data-tour="app-header-account-menu"
      {...props}
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
    </Button>
  );
}
