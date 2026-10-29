import { CATALOGUES, type Locale, type Messages } from '@trybun/i18n/catalogues';

/** Namespaces only the server uses: e-mails and the Keycloak login theme. */
const SERVER_NAMESPACES = new Set<string>(['emails', 'keycloak'] satisfies (keyof Messages)[]);

/** The messages of the web application. */
export type WebMessages = Omit<Messages, 'emails' | 'keycloak'>;

/** The messages of the web application in a language, without the namespaces of the server. */
export function getWebMessages(locale: Locale): WebMessages {
  return Object.fromEntries(
    Object.entries(CATALOGUES[locale]).filter(([namespace]) => !SERVER_NAMESPACES.has(namespace)),
  ) as WebMessages;
}

const ROOT = ['ui'] as const satisfies (keyof WebMessages)[];
const TEAM = [...ROOT, 'app', 'appShell', 'help', 'languages', 'productTours'] as const;

/**
 * The namespaces the client components of a route use, by the layout whose
 * `NextIntlClientProvider` passes them to the browser (§18.5). Server Components read every
 * namespace of the request, so only the texts of client components travel in the page. A nested
 * provider replaces the messages of its parent, so every set contains the sets of its parents.
 */
export const CLIENT_NAMESPACES = {
  /** `app/layout.tsx`: the components of `@trybun/ui`. */
  root: ROOT,
  /** `app/sign-in/layout.tsx` */
  signIn: [...ROOT, 'signIn'],
  /** `app/setup/layout.tsx` */
  setup: [...ROOT, 'errors', 'languages', 'setup'],
  /** `app/(team)/layout.tsx`: the application shell, its menus and the product tours. */
  team: TEAM,
  /** `app/(team)/admin/layout.tsx` */
  administration: [...TEAM, 'administration'],
  /** `app/(team)/admin/accounts/layout.tsx` */
  accounts: [...TEAM, 'administration', 'errors', 'users'],
  /** `app/(team)/admin/organizations/layout.tsx` */
  organizations: [...TEAM, 'administration', 'errors', 'organizations'],
  /** `app/(team)/projects/layout.tsx` */
  projects: [...TEAM, 'errors', 'projects'],
  /** `app/(team)/settings/layout.tsx` */
  settings: [...TEAM, 'errors', 'users'],
} as const satisfies Record<string, readonly (keyof WebMessages)[]>;

/** The route layouts that provide messages to client components. */
export type ClientMessagesRoute = keyof typeof CLIENT_NAMESPACES;

/** The messages the client components of a route need, for its `NextIntlClientProvider`. */
export function pickClientMessages<Route extends ClientMessagesRoute>(
  messages: WebMessages,
  route: Route,
): Pick<WebMessages, (typeof CLIENT_NAMESPACES)[Route][number]> {
  return Object.fromEntries(
    CLIENT_NAMESPACES[route].map((namespace) => [namespace, messages[namespace]]),
  ) as Pick<WebMessages, (typeof CLIENT_NAMESPACES)[Route][number]>;
}
