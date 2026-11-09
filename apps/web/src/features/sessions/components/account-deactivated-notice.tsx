import { getTranslations } from 'next-intl/server';
import { SignOutButton } from './sign-out-button.js';

/**
 * Shown instead of the application shell when the API refuses the account of a valid sign-in
 * (`401`), e.g. after a deactivation whose Keycloak job has not run yet (§7.4): the person can only
 * sign out.
 */
export async function AccountDeactivatedNotice() {
  const t = await getTranslations('signIn');
  return (
    <main className="mx-auto flex max-w-lg flex-col items-start gap-3 p-4 pt-12">
      <h1 className="text-2xl font-bold">{t('accountDeactivatedTitle')}</h1>
      <p className="text-muted-foreground">{t('accountDeactivatedText')}</p>
      <SignOutButton label={t('signOut')} />
    </main>
  );
}
