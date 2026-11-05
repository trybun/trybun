import { getTranslations } from 'next-intl/server';
import { AccountSettingsForm } from '../../../features/users/components/account-settings-form.js';
import { requireSession } from '../../../lib/auth/session.js';
import { getEnv } from '../../../lib/env/env.js';

/**
 * The Account settings page (§13.1): the language and the time zone of the signed-in person. The
 * account comes from the query the team layout prefetched.
 */
export default async function SettingsPage() {
  await requireSession();
  const t = await getTranslations('users.settings');
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <AccountSettingsForm systemTimeZone={getEnv().defaultTimeZone} />
    </div>
  );
}
