import { NotFoundNotice } from '../../features/app-shell/components/not-found-notice.js';

/**
 * `notFound()` of a team view (§18.5, #401) – a ticket, a project or a record of the
 * Administrator panel that does not exist or is not visible – inside the application shell, so the
 * navigation stays usable.
 */
export default function TeamNotFound() {
  return <NotFoundNotice home="/" />;
}
