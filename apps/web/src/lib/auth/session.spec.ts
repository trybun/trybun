import { afterEach, describe, expect, it, vi } from 'vitest';
import { REQUEST_PATH_HEADER } from './callback-path.js';

vi.mock('server-only', () => ({}));
const getServerSession = vi.fn<() => Promise<unknown>>();
vi.mock('next-auth', () => ({ getServerSession }));
vi.mock('./auth-options.js', () => ({
  createAuthOptions: () => ({}),
  getAccessTokens: vi.fn(),
  SIGN_IN_PATH: '/sign-in',
  sessionCookieName: () => 'session',
}));
const requestHeaders = new Headers();
vi.mock('next/headers.js', () => ({
  headers: () => Promise.resolve(requestHeaders),
  cookies: vi.fn(),
}));
vi.mock('next/server.js', () => ({ connection: () => Promise.resolve() }));
const redirect = vi.fn((url: string) => {
  throw new Error(`redirect ${url}`);
});
vi.mock('next/navigation.js', () => ({ redirect }));

const { requireSession } = await import('./session.js');

describe('requireSession', () => {
  afterEach(() => {
    requestHeaders.delete(REQUEST_PATH_HEADER);
    getServerSession.mockReset();
  });

  it('returns the session of the request', async () => {
    const session = { user: { id: 'u1' } };
    getServerSession.mockResolvedValue(session);

    await expect(requireSession()).resolves.toBe(session);
  });

  it.each([
    ['/projects?state=archived', '/sign-in?callbackUrl=%2Fprojects%3Fstate%3Darchived'],
    [null, '/sign-in?callbackUrl=%2F'],
    ['//evil.example.com/', '/sign-in?callbackUrl=%2F'],
    ['https://evil.example.com/', '/sign-in?callbackUrl=%2F'],
  ])('without a session, returns to the opened page %j after the sign-in', async (path, url) => {
    getServerSession.mockResolvedValue(null);
    if (path !== null) {
      requestHeaders.set(REQUEST_PATH_HEADER, path);
    }

    await expect(requireSession()).rejects.toThrow(`redirect ${url}`);
  });

  it('prefers the path given by the page', async () => {
    getServerSession.mockResolvedValue(null);
    requestHeaders.set(REQUEST_PATH_HEADER, '/projects');

    await expect(requireSession('/help')).rejects.toThrow('redirect /sign-in?callbackUrl=%2Fhelp');
  });
});
