import { Brand } from './brand.js';

/**
 * The header of the public pages outside the application shell, e.g. the acceptance of an
 * invitation or the first-run wizard: the brand only, like the login screen of Keycloak – these
 * pages need no session, so there is no user menu.
 */
export function PublicHeader() {
  return (
    <header className="flex h-14 items-center gap-2 border-b border-border bg-background px-3 md:px-5">
      <Brand />
    </header>
  );
}
