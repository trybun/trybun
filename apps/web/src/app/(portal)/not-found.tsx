import type { Metadata } from 'next';
import {
  NotFoundNotice,
  notFoundMetadata,
} from '../../features/app-shell/components/not-found-notice.js';

/**
 * The translated tab title: Next.js reads this metadata for a page whose `generateMetadata` calls
 * `notFound()` (#404).
 */
export function generateMetadata(): Promise<Metadata> {
  return notFoundMetadata();
}

/**
 * `notFound()` of a portal view (§18.5, #401) – a ticket or a project that does not exist or is
 * not visible – inside the application shell, so the navigation stays usable.
 */
export default function PortalNotFound() {
  return <NotFoundNotice home="/portal" />;
}
