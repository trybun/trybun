'use client';

import { Button } from '@trybun/ui/components/button';
import { UserPlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { lazy, Suspense } from 'react';

// The dialog opens only on request, so its code loads after the first paint (§18.5); the server
// renders its button. The fallback is the same button: React drops the server HTML of a boundary
// that receives an update before its code has loaded, and without it the button vanished while the
// page hydrated, moving the content below it under the finger (#308).
const AddMemberDialog = lazy(() =>
  import('./add-member-dialog.js').then((module) => ({ default: module.AddMemberDialog })),
);

/** The Add member button and dialog, loaded after the first paint. */
export function LazyAddMemberDialog({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  return (
    <Suspense
      fallback={
        <Button className="w-full md:w-fit">
          <UserPlusIcon aria-hidden />
          {t('members.add')}
        </Button>
      }
    >
      <AddMemberDialog projectId={projectId} />
    </Suspense>
  );
}
