import { HouseIcon, type LucideIcon } from 'lucide-react';

/** A destination of the main navigation; its label is a key of the `appShell` namespace. */
export interface NavigationItem {
  href: string;
  labelKey: 'home';
  icon: LucideIcon;
}

/**
 * The destinations of the main navigation, shown in the side navigation from the tablet width
 * on and in the bottom navigation on phones (§2.9). Feature tasks add their views here.
 */
export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { href: '/', labelKey: 'home', icon: HouseIcon },
];

/** Whether a destination is the current page or one of its sub-pages. */
export function isCurrent(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
