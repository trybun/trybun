import type { Metadata } from 'next';
import {
  NotFoundNotice,
  notFoundMetadata,
} from '../features/app-shell/components/not-found-notice.js';
import { PublicHeader } from '../features/app-shell/components/public-header.js';

/** The translated tab title: Next.js reads this metadata for an unmatched address. */
export function generateMetadata(): Promise<Metadata> {
  return notFoundMetadata();
}

/**
 * An address that matches no route (§18.5, #401) – no page outside the route groups of the
 * application shell calls `notFound()`. It renders below the root layout without a shell, so it is
 * a page of its own with the header of the public pages, like `app/error.tsx`. The home of the
 * team leads an end user on to the portal and a person without a session to the sign-in.
 */
export default function RootNotFound() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-lg flex-col p-4 pt-12">
        <NotFoundNotice home="/" withTabTitle={false} />
      </main>
    </>
  );
}
