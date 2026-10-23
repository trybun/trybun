// The browser sign-in of the web application (authorization code with PKCE, §14.4), driven over
// HTTP through the Keycloak login forms, as a browser would submit them.
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { WEB_CLIENT_SECRET, WEB_URL, type TestKeycloak } from './keycloak.js';

const REDIRECT_URI = `${WEB_URL}/api/auth/callback/keycloak`;

export interface SignInResult {
  /** The page Keycloak shows instead of completing the sign-in, e.g. a required action. */
  stoppedAt?: string;
  accessToken?: string;
}

/** The current TOTP (RFC 6238, SHA-1, 6 digits, 30 seconds) of a Keycloak OTP secret. */
export function totp(secret: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hmac = createHmac('sha1', Buffer.from(secret)).update(counter).digest();
  const offset = (hmac.at(-1) ?? 0) & 0x0f;
  return String((hmac.readUInt32BE(offset) & 0x7f_ff_ff_ff) % 1_000_000).padStart(6, '0');
}

export async function signIn(
  keycloak: TestKeycloak,
  credentials: { username: string; password: string; otpSecret?: string },
): Promise<SignInResult> {
  const cookies = new Map<string, string>();
  async function send(url: string, form?: Record<string, string>): Promise<Response> {
    const response = await fetch(url, {
      method: form === undefined ? 'GET' : 'POST',
      redirect: 'manual',
      headers: { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') },
      body: form === undefined ? undefined : new URLSearchParams(form),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair = ''] = cookie.split(';');
      const index = pair.indexOf('=');
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  }
  const formAction = (html: string): string =>
    (/<form[^>]*action="([^"]+)"/.exec(html)?.[1] ?? '').replaceAll('&amp;', '&');

  const verifier = randomBytes(32).toString('base64url');
  const authorize = new URL(`${keycloak.url}/realms/trybun/protocol/openid-connect/auth`);
  authorize.search = new URLSearchParams({
    client_id: 'trybun-web',
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid',
    state: randomBytes(8).toString('hex'),
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  }).toString();
  let response = await send(authorize.href);
  response = await send(formAction(await response.text()), {
    username: credentials.username,
    password: credentials.password,
  });
  if (response.status === 200 && credentials.otpSecret !== undefined) {
    response = await send(formAction(await response.text()), {
      otp: totp(credentials.otpSecret),
    });
  }
  const location = response.headers.get('location') ?? '';
  const code = location.startsWith(REDIRECT_URI)
    ? new URL(location).searchParams.get('code')
    : null;
  if (code === null) {
    return { stoppedAt: location === '' ? `status ${response.status}` : location };
  }
  const tokens = await fetch(`${keycloak.url}/realms/trybun/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: 'trybun-web',
      client_secret: WEB_CLIENT_SECRET,
      code_verifier: verifier,
    }),
  });
  const { access_token: accessToken } = (await tokens.json()) as { access_token: string };
  return { accessToken };
}
