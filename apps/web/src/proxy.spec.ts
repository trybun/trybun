import { NextRequest } from 'next/server.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_ENV } from '../test/env.js';

vi.mock('server-only', () => ({}));

const { contentSecurityPolicy, proxy, securityHeaders } = await import('./proxy.js');

const options = {
  nonce: 'bm9uY2U=',
  keycloakOrigin: 'https://trybun.example.com',
  isHttps: true,
  isDevelopment: false,
};

describe('security headers', () => {
  it('allow only scripts with the nonce, and no framing', () => {
    expect(contentSecurityPolicy(options)).toBe(
      [
        "default-src 'self'",
        "script-src 'self' 'nonce-bm9uY2U=' 'strict-dynamic'",
        "style-src 'self' 'nonce-bm9uY2U='",
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self' https://trybun.example.com",
        "frame-ancestors 'none'",
        'upgrade-insecure-requests',
      ].join('; '),
    );
  });

  it('allow eval only in development and upgrade requests only on HTTPS', () => {
    const policy = contentSecurityPolicy({ ...options, isHttps: false, isDevelopment: true });

    expect(policy).toContain("'strict-dynamic' 'unsafe-eval';");
    expect(policy).not.toContain('upgrade-insecure-requests');
  });

  it('include HSTS, nosniff and the referrer and permissions policies', () => {
    expect(securityHeaders(options)).toMatchObject({
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': expect.stringContaining('camera=()') as unknown,
    });
  });
});

describe('proxy', () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(TEST_ENV)) {
      vi.stubEnv(name, value);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sets a new nonce for every request, on the response and for the rendering', () => {
    const nonces = [1, 2].map(() => {
      const response = proxy(new NextRequest('http://localhost:3000/'));
      const policy = response.headers.get('content-security-policy') ?? '';
      // Next.js renders with the request headers it receives through `x-middleware-request-*`.
      expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(policy);
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      return /'nonce-([^']+)'/.exec(policy)?.[1];
    });

    expect(nonces[0]).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(nonces[0]).not.toBe(nonces[1]);
  });

  it('passes the path of the opened page to the rendering, never one sent by the browser', () => {
    const response = proxy(
      new NextRequest('http://localhost:3000/projects?state=archived', {
        headers: { 'x-trybun-request-path': '//evil.example.com/' },
      }),
    );

    expect(response.headers.get('x-middleware-request-x-trybun-request-path')).toBe(
      '/projects?state=archived',
    );
  });
});
