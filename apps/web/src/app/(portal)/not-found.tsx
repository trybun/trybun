import { NotFoundNotice } from '../../features/app-shell/components/not-found-notice.js';

/**
 * `notFound()` of a portal view (§18.5, #401) – a ticket or a project that does not exist or is
 * not visible – inside the application shell, so the navigation stays usable.
 */
export default function PortalNotFound() {
  return <NotFoundNotice home="/portal" />;
}
