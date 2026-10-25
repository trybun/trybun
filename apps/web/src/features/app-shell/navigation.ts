import type { CurrentUserAction } from '@trybun/contracts/users';
import { HouseIcon, type LucideIcon, SettingsIcon } from 'lucide-react';

/** A destination of the main navigation; its label is a key of the `appShell` namespace. */
export interface NavigationItem {
  href: string;
  labelKey: 'home' | 'administration';
  icon: LucideIcon;
  /** The global action of the account the destination needs (`allowedActions`, §18.3). */
  requiredAction?: CurrentUserAction;
  /**
   * Whether the bottom navigation of phones shows it; its few slots are kept for daily work, and
   * the account menu leads to the rest (§2.9).
   */
  isOnPhones: boolean;
}

/**
 * The destinations of the main navigation, shown in the side navigation from the tablet width
 * on and in the bottom navigation on phones (§2.9). Feature tasks add their views here.
 */
export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { href: '/', labelKey: 'home', icon: HouseIcon, isOnPhones: true },
  {
    href: '/admin',
    labelKey: 'administration',
    icon: SettingsIcon,
    requiredAction: 'open_administration',
    isOnPhones: false,
  },
];

/** The destinations the account may open, from the `allowedActions` of the API (§18.5). */
export function navigationItemsFor(
  allowedActions: readonly CurrentUserAction[] | undefined,
  device: 'phone' | 'wide',
): NavigationItem[] {
  return NAVIGATION_ITEMS.filter(
    (item) =>
      (device === 'wide' || item.isOnPhones) &&
      (item.requiredAction === undefined || (allowedActions ?? []).includes(item.requiredAction)),
  );
}

/** Whether a destination is the current page or one of its sub-pages. */
export function isCurrent(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
