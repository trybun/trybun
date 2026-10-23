import { redirect } from 'next/navigation.js';
import { z } from 'zod';
import { SignInRedirect } from '../../features/sessions/components/sign-in-redirect.js';

const searchParamsSchema = z.object({
  // A path of the application; Auth.js also refuses redirects to other origins.
  callbackUrl: z
    .string()
    .regex(/^\/(?!\/)/)
    .catch('/'),
  error: z.string().optional().catch(undefined),
});

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
  return <SignInRedirect callbackUrl={callbackUrl} />;
}
