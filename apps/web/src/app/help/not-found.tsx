import { NotFoundNotice } from '../../features/app-shell/components/not-found-notice.js';

/**
 * A help page that does not exist or that the reader does not receive (§2.3, §18.5, #401), inside
 * the application shell of the reader, with the way back to all help topics.
 */
export default function HelpNotFound() {
  return <NotFoundNotice home="/help" />;
}
