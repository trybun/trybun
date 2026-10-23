import { endLoggedOutSessions } from '../../../../lib/auth/backchannel-logout.js';

/**
 * Back-channel logout of Keycloak (§14.4): Keycloak posts a signed logout token over the internal
 * network when a Keycloak session ends; the web sessions of that Keycloak session are deleted.
 */
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => undefined);
  const logoutToken = form?.get('logout_token');
  const isEnded = typeof logoutToken === 'string' ? await endLoggedOutSessions(logoutToken) : false;
  return new Response(null, {
    status: isEnded ? 200 : 400,
    headers: { 'Cache-Control': 'no-store' },
  });
}
