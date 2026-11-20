'use client';

import { ErrorNotice } from '../../features/app-shell/components/error-notice.js';

/**
 * An unexpected error of a team view (§18.5, #382), inside the application shell, so the
 * navigation stays usable.
 */
export default function TeamError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorNotice retry={retry} />;
}
