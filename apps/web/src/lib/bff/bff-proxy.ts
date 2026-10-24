import 'server-only';
import type { NextRequest } from 'next/server.js';
import type { AccessTokens } from '../auth/access-tokens.js';
import { problemResponse } from './problem-response.js';

/** Methods that change state and therefore need the CSRF `Origin` check (§14.4). */
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Incoming webhooks: authenticated by the API from their signature alone (§14.4). */
const WEBHOOK_PATH = /^\/api\/v1\/webhooks\/(?:github|email\/[^/]+)$/;

/**
 * Headers of the connection to the BFF (RFC 9110, section 7.6.1) and the content length of the body,
 * which `fetch` sets again; the cookies of the browser never reach the API (§14.4).
 */
const DROPPED_REQUEST_HEADERS = [
  'connection',
  'keep-alive',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  'cookie',
];

/**
 * Headers of the connection to the API, and the encoding of a body that `fetch` has already
 * decoded; the API sets no cookies.
 */
const DROPPED_RESPONSE_HEADERS = [
  'connection',
  'keep-alive',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-encoding',
  'content-length',
  'set-cookie',
];

export interface BffProxyDependencies {
  /** The API on the internal network. */
  apiUrl: string;
  /** The origin of the web application, which state-changing browser requests must send. */
  origin: string;
  sessionCookieName: string;
  accessTokens: AccessTokens;
}

/** A request of the BFF proxy, with the headers it forwards and the reason to reject it. */
type Credentials = { rejection: Response } | { authorization?: string };

/**
 * The BFF endpoint `/api/v1/*` (§14.4): forwards a request to the same path of the API over the
 * internal network, with the access token of the session attached on the server.
 */
export function createBffProxy({
  apiUrl,
  origin,
  sessionCookieName,
  accessTokens,
}: BffProxyDependencies): (request: NextRequest) => Promise<Response> {
  async function credentialsOf(request: NextRequest): Promise<Credentials> {
    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const authorization = request.headers.get('authorization');
    if (authorization !== null) {
      // An API token of an integration (§12.2), forwarded unchanged; together with a session
      // cookie the principal would be ambiguous (RFC 6750, section 3.1: one method per request).
      return sessionToken === undefined
        ? { authorization }
        : { rejection: problemResponse('request.malformed') };
    }
    if (STATE_CHANGING_METHODS.has(request.method) && request.headers.get('origin') !== origin) {
      return { rejection: problemResponse('request.forbidden') };
    }
    const accessToken =
      sessionToken === undefined ? undefined : await accessTokens.forSession(sessionToken);
    return accessToken === undefined ? {} : { authorization: `Bearer ${accessToken}` };
  }

  return async function proxy(request) {
    const headers = new Headers(request.headers);
    for (const name of DROPPED_REQUEST_HEADERS) {
      headers.delete(name);
    }
    // Webhooks go to the API byte for byte, without the check of browser credentials.
    if (!WEBHOOK_PATH.test(request.nextUrl.pathname)) {
      const credentials = await credentialsOf(request);
      if ('rejection' in credentials) {
        return credentials.rejection;
      }
      headers.delete('authorization');
      if (credentials.authorization !== undefined) {
        headers.set('authorization', credentials.authorization);
      }
    }
    return forward(
      request,
      `${apiUrl}${request.nextUrl.pathname}${request.nextUrl.search}`,
      headers,
    );
  };
}

async function forward(request: NextRequest, url: string, headers: Headers): Promise<Response> {
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  // A streamed request body (uploads, webhooks) needs the half-duplex mode of Node.js, which the
  // DOM type of `RequestInit` does not declare yet.
  const init: RequestInit & { duplex: 'half' } = {
    method: request.method,
    headers,
    body: hasBody ? request.body : null,
    duplex: 'half',
    redirect: 'manual',
    cache: 'no-store',
    signal: request.signal,
  };
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    // A network error: the API is unreachable (§17.2). An aborted request propagates.
    if (!(error instanceof TypeError)) {
      throw error;
    }
    return problemResponse('server.unavailable');
  }
  const responseHeaders = new Headers(response.headers);
  for (const name of DROPPED_RESPONSE_HEADERS) {
    responseHeaders.delete(name);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
