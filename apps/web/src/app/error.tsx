'use client';

import { ErrorNotice } from '../features/app-shell/components/error-notice.js';
import { PublicHeader } from '../features/app-shell/components/public-header.js';

/**
 * An unexpected error outside the route groups of the application shell – the sign-in, the setup,
 * the invitations, the help – or in the shell itself (§18.5, #382). It replaces the page below the
 * root layout, so it is a page of its own, with the header of the public pages.
 */
export default function RootError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-lg flex-col p-4 pt-12">
        <ErrorNotice retry={retry} />
      </main>
    </>
  );
}
