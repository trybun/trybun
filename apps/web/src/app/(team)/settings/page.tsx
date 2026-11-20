import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageTitle } from '../../../features/app-shell/page-title.js';
import { AccountSettingsPage } from '../../../features/users/components/account-settings-page.js';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('users.settings');
  return pageTitle(t('title'));
}

/** The Account settings page of the team (§13.1). */
export default function SettingsPage() {
  return <AccountSettingsPage />;
}
