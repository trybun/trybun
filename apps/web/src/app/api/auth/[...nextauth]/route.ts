import type { NextRequest } from 'next/server.js';
import { createAuthOptions } from '../../../../lib/auth/auth-options.js';
import { NextAuth } from '../../../../lib/auth/next-auth.js';

type Context = { params: Promise<{ nextauth: string[] }> };

/** Auth.js (§14.4): sign-in with Keycloak, callback, session and sign-out. */
function handler(request: NextRequest, context: Context): Promise<Response> {
  return NextAuth(request, context, createAuthOptions({})) as Promise<Response>;
}

export { handler as GET, handler as POST };
