import 'server-only';
import { getTranslations } from 'next-intl/server';
import { requireSession } from '../../../lib/auth/session.js';
import { getEnv } from '../../../lib/env/env.js';
import { AccountSettingsForm } from './account-settings-form.js';

/**
 * The Account settings page (§13.1): the language and the time zone of the signed-in person, at
 * `/settings` for the team and `/portal/settings` for end users (Q17). The account comes from the
 * query the application shell prefetched.
 */
export async function AccountSettingsPage() {
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
