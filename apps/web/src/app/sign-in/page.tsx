import type { Metadata } from 'next';
import { redirect } from 'next/navigation.js';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { pageTitle } from '../../features/app-shell/page-title.js';
import { SignInRedirect } from '../../features/sessions/components/sign-in-redirect.js';
import { SetupPendingNotice } from '../../features/setup/components/setup-pending-notice.js';
import { getServerApiClient } from '../../lib/api-client/server-api-client.js';
const searchParamsSchema = z.object({
  // A path of the application; Auth.js also refuses redirects to other origins.
  callbackUrl: z
    .string()
    .regex(/^\/(?!\/)/)
    .catch('/'),
  error: z.string().optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signIn');
  return pageTitle(t('tabTitle'));
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { callbackUrl, error } = searchParamsSchema.parse(await searchParams);
  // A failed sign-in shows the error page of Auth.js instead of starting the sign-in again.
  if (error !== undefined) {
    redirect(`/api/auth/error?${new URLSearchParams({ error }).toString()}`);
  }
  // Before the first Administrator exists, no account can sign in (§15.6). An unavailable API
  // does not block the sign-in.
  const client = await getServerApiClient();
  const setup = await client.GET('/api/v1/setup').then(
    ({ data }) => data,
    () => undefined,
  );
  if (setup?.status === 'available') {
    return <SetupPendingNotice />;
  }
  return <SignInRedirect callbackUrl={callbackUrl} />;
}
