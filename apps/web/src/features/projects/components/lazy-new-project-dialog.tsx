'use client';

import { Button } from '@trybun/ui/components/button';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { lazy, Suspense } from 'react';

// The dialog opens only on request, so its form code loads after the first paint (§18.5); the server
// renders its button. The fallback is the same button: React drops the server HTML of a boundary
// that receives an update before its code has loaded, and without it the button vanished while the
// page hydrated, moving the list below it under the finger (#308).
const NewProjectDialog = lazy(() =>
  import('./new-project-dialog.js').then((module) => ({ default: module.NewProjectDialog })),
);

/** The New project button and dialog, loaded after the first paint. */
export function LazyNewProjectDialog() {
  const t = useTranslations('projects.create');
  return (
    <Suspense
      fallback={
        <Button className="w-full md:w-fit">
          <PlusIcon aria-hidden />
          {t('open')}
        </Button>
      }
    >
      <NewProjectDialog />
    </Suspense>
  );
}
