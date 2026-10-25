import { getTranslations } from 'next-intl/server';
import { SetupWizard } from '../../features/setup/components/setup-wizard.js';

/**
 * The first-run wizard (§15.6), outside the team views: it needs no session. The token of the
 * setup link is in the fragment of the address, which only the browser reads.
 */
export default async function SetupPage() {
  const t = await getTranslations('setup');
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 pt-8 md:pt-12">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <SetupWizard />
    </main>
  );
}
