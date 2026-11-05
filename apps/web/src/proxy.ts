import { type NextRequest, NextResponse } from 'next/server.js';
import { REQUEST_PATH_HEADER } from './lib/auth/callback-path.js';
import { getEnv } from './lib/env/env.js';

export interface SecurityHeadersOptions {
  /** The nonce of the request: the only inline and loaded scripts the page may run. */
  nonce: string;
  /** The origin of Keycloak, where the sign-in continues (§15.5). */
  keycloakOrigin: string;
  /** Whether the web application is served over HTTPS, as in every deployment (§15.8). */
  isHttps: boolean;
  /** `next dev`: React needs `eval` for its debugging information. */
  isDevelopment: boolean;
}

/**
 * The strict Content Security Policy of the pages (§13.5): scripts only with the nonce of the
 * request (Next.js adds it to its own scripts), everything else from the web application itself,
 * no plugins and no framing.
 */
export function contentSecurityPolicy({
  nonce,
  keycloakOrigin,
  isHttps,
  isDevelopment,
}: SecurityHeadersOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Style attributes cannot run scripts; `next/image` and the positioning of overlays use them.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    `form-action 'self' ${keycloakOrigin}`,
    "frame-ancestors 'none'",
    ...(isHttps ? ['upgrade-insecure-requests'] : []),
  ];
  return directives.join('; ');
}

/** The security headers of every page, set in this one place (§13.5). */
export function securityHeaders(options: SecurityHeadersOptions): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(options),
    // HTTPS only (§13.5): browsers ignore the header on plain HTTP, e.g. on localhost.
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // No page uses a powerful browser feature.
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), midi=(), display-capture=(), browsing-topics=()',
  };
}

/**
 * The security headers and the CSP nonce of the pages (§13.5, §18.5). Next.js reads the nonce from
 * the `Content-Security-Policy` request header and adds it to the scripts it renders, so every page
 * is rendered per request. The path of the page goes to the rendering too, so the sign-in returns
 * to it.
 */
export function proxy(request: NextRequest): NextResponse {
  const env = getEnv();
  const headers = securityHeaders({
    nonce: Buffer.from(crypto.randomUUID()).toString('base64'),
    keycloakOrigin: new URL(env.keycloak.issuer).origin,
    isHttps: env.shouldUseSecureCookies,
    isDevelopment: env.isDevelopment,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', headers['Content-Security-Policy'] ?? '');
  requestHeaders.set(REQUEST_PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: [
    // Pages only: not the Route Handlers of `/api` (the BFF, Auth.js), whose bodies the proxy
    // would buffer, nor the static files and the prefetches of links (Next.js CSP guide).
    {
      source: '/((?!api/|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
