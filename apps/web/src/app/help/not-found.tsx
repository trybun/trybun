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
 * A help page that does not exist or that the reader does not receive (§2.3, §18.5, #401), inside
 * the application shell of the reader, with the way back to all help topics.
 */
export default function HelpNotFound() {
  return <NotFoundNotice home="/help" />;
}
