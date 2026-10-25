import { getTranslations } from 'next-intl/server';

/**
 * Shown by the sign-in page while no Administrator exists (§15.6): no account could pass the
 * Keycloak sign-in yet, so the page points to the setup link instead.
 */
export async function SetupPendingNotice() {
  const t = await getTranslations('signIn');
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-3 p-4 pt-12">
      <h1 className="text-2xl font-bold">{t('notSetUpTitle')}</h1>
      <p className="text-muted-foreground">
        {t.rich('notSetUpText', {
          command: (chunks) => <code className="font-mono text-foreground">{chunks}</code>,
        })}
      </p>
    </main>
  );
}
