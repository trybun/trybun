import 'server-only';
import type { NextRequest } from 'next/server.js';
import { getAccessTokens, sessionCookieName } from '../auth/auth-options.js';
import { getEnv } from '../env/env.js';
import { createBffProxy } from './bff-proxy.js';

let proxy: ((request: NextRequest) => Promise<Response>) | undefined;

/** The BFF proxy of the process, created on its first request. */
export function getBffProxy(): (request: NextRequest) => Promise<Response> {
  if (proxy === undefined) {
    const env = getEnv();
    proxy = createBffProxy({
      apiUrl: env.apiUrl,
      origin: env.origin,
      sessionCookieName: sessionCookieName(),
      accessTokens: getAccessTokens(),
    });
  }
  return proxy;
}
