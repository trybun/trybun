import { getTranslations } from 'next-intl/server';
import { PublicHeader } from '../../features/app-shell/components/public-header.js';
import { InvitationAcceptance } from '../../features/invitations/components/invitation-acceptance.js';
import { getEnv } from '../../lib/env/env.js';

/**
 * The acceptance page of an invitation (ADR 0009), outside the team views: it needs no session.
 * The token of the link is in the fragment of the address, which only the browser reads.
 */
export default async function InvitationsPage() {
  const t = await getTranslations('invitations.acceptance');
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 pt-8 md:pt-12">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <InvitationAcceptance endUserProviders={getEnv().endUserIdentityProviders} />
      </main>
    </>
  );
}
