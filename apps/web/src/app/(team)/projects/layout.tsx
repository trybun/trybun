import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LazyToaster } from '../../../features/app-shell/components/lazy-toaster.js';
import { pickClientMessages } from '../../../lib/i18n/messages.js';

/**
 * The project views, their texts in the browser (§18.5) and their toasts (e.g. "Project archived"
 * with Undo). The toast region is mounted here, not in the shell of every team view: its code
 * would count towards the Lighthouse budget of the empty shell (§2.9).
 */
export default async function ProjectsLayout({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider messages={pickClientMessages(await getMessages(), 'projects')}>
      {children}
      <LazyToaster />
    </NextIntlClientProvider>
  );
}
