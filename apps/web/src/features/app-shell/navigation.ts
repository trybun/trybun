import type { CurrentUserAction } from '@trybun/contracts/users';
import {
  FolderKanbanIcon,
  HouseIcon,
  type LucideIcon,
  SettingsIcon,
  TicketIcon,
} from 'lucide-react';

/** A destination of the main navigation; its label is a key of the `appShell` namespace. */
export interface NavigationItem {
  href: string;
  labelKey: 'home' | 'projects' | 'tickets' | 'administration' | 'myTickets';
  icon: LucideIcon;
  /** The global action of the account the destination needs (`allowedActions`, §18.3). */
  requiredAction?: CurrentUserAction;
  /**
   * Whether the bottom navigation of phones shows it; its few slots are kept for daily work, and
   * the account menu leads to the rest (§2.9).
   */
  isOnPhones: boolean;
  /**
   * The paths of the destination when they are not its sub-pages: the portal root is the current
   * page only on itself and on the project homes, never on "My tickets" below it.
   */
  currentPaths?: readonly string[];
}

/**
 * The destinations of the team's navigation, shown in the side navigation from the tablet width
 * on and in the bottom navigation on phones (§2.9). Feature tasks add their views here.
 */
export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { href: '/', labelKey: 'home', icon: HouseIcon, isOnPhones: true },
  { href: '/tickets', labelKey: 'tickets', icon: TicketIcon, isOnPhones: true },
  { href: '/projects', labelKey: 'projects', icon: FolderKanbanIcon, isOnPhones: true },
  {
    href: '/admin',
    labelKey: 'administration',
    icon: SettingsIcon,
    requiredAction: 'open_administration',
    isOnPhones: false,
  },
];

/** The address of the portal root, the projects of an end user (§5.7). */
export const PORTAL_HREF = '/portal';

/** The address of "My tickets" of the portal (§5.7). */
export const MY_TICKETS_HREF = '/portal/tickets';

/** The projects of the portal: the portal root and the project homes. */
const PORTAL_PROJECTS_ITEM: NavigationItem = {
  href: PORTAL_HREF,
  labelKey: 'projects',
  icon: FolderKanbanIcon,
  isOnPhones: true,
  currentPaths: [PORTAL_HREF, `${PORTAL_HREF}/projects`],
};

const MY_TICKETS_ITEM: NavigationItem = {
  href: MY_TICKETS_HREF,
  labelKey: 'myTickets',
  icon: TicketIcon,
  isOnPhones: true,
};

/**
 * What decides the destinations of a shell: the global actions of a team account, or for the
 * portal whether the end user has more than one active project to choose from (§5.7). Plain data,
 * so a server layout passes it to the client navigation.
 */
export type NavigationContext =
  | { shell: 'team'; allowedActions: readonly CurrentUserAction[] }
  | { shell: 'portal'; hasProjectChoice: boolean };

/**
 * The destinations of a shell: for the team the ones the account may open, from the
 * `allowedActions` of the API (§18.5); for the portal **Projects**, only with a choice of
 * projects, and **My tickets**.
 */
export function navigationItemsFor(
  context: NavigationContext,
  device: 'phone' | 'wide',
): NavigationItem[] {
  if (context.shell === 'portal') {
    return context.hasProjectChoice ? [PORTAL_PROJECTS_ITEM, MY_TICKETS_ITEM] : [MY_TICKETS_ITEM];
  }
  return NAVIGATION_ITEMS.filter(
    (item) =>
      (device === 'wide' || item.isOnPhones) &&
      (item.requiredAction === undefined || context.allowedActions.includes(item.requiredAction)),
  );
}

/** Whether a destination is the current page or one of its sub-pages. */
export function isCurrent(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Whether a destination of the navigation is the current page (see `currentPaths`). */
export function isCurrentItem(item: NavigationItem, pathname: string): boolean {
  if (item.currentPaths === undefined) {
    return isCurrent(item.href, pathname);
  }
  return item.currentPaths.some((path) =>
    path === item.href ? pathname === path : isCurrent(path, pathname),
  );
}
