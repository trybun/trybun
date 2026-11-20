'use client';

import { ErrorNotice } from '../../features/app-shell/components/error-notice.js';

/**
 * An unexpected error of a portal view (§18.5, #382), inside the application shell, so the
 * navigation stays usable.
 */
export default function PortalError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorNotice retry={retry} />;
}
