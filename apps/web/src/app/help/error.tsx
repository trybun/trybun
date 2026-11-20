'use client';

import { ErrorNotice } from '../../features/app-shell/components/error-notice.js';

/**
 * An unexpected error of a help page (§2.3, §18.5, #382), inside the application shell of the
 * reader, so the navigation stays usable.
 */
export default function HelpError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorNotice retry={retry} />;
}
