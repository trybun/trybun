import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';

vi.mock('server-only', () => ({}));
const getAccessToken = vi.fn<() => Promise<string | undefined>>();
vi.mock('../auth/session.js', () => ({ getAccessToken }));
const requestHeaders = new Headers();
vi.mock('next/headers.js', () => ({ headers: () => Promise.resolve(requestHeaders) }));
for (const [name, value] of Object.entries(TEST_ENV)) {
  vi.stubEnv(name, value);
}

const { getServerApiClient, metadataAfterRead } = await import('./server-api-client.js');
const { ApiError } = await import('../errors/api-error.js');

describe('getServerApiClient', () => {
  const requests: Request[] = [];

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((request: Request) => {
        requests.push(request);
        return Promise.resolve(Response.json({ id: 'u1' }));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    requests.length = 0;
    requestHeaders.delete('x-forwarded-for');
  });

  it('calls the API on the internal network with the access token of the session', async () => {
    getAccessToken.mockResolvedValue('access-token-1');

    const { data } = await (await getServerApiClient()).GET('/api/v1/users/me');

    expect(data).toEqual({ id: 'u1' });
    expect(requests[0]?.url).toBe(`${TEST_ENV.TRYBUN_API_URL}/api/v1/users/me`);
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer access-token-1');
  });

  it('calls the API without credentials when there is no session', async () => {
    getAccessToken.mockResolvedValue(undefined);

    await (await getServerApiClient()).GET('/api/v1/users/me');

    expect(requests[0]?.headers.get('authorization')).toBeNull();
  });

  it('passes the client IP of the request on for the rate limits of the API', async () => {
    getAccessToken.mockResolvedValue(undefined);
    requestHeaders.set('x-forwarded-for', '203.0.113.7');

    await (await getServerApiClient()).GET('/api/v1/setup');

    expect(requests[0]?.headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });
});

describe('metadataAfterRead', () => {
  it('keeps the metadata of the layouts for a record the page shows', async () => {
    await expect(metadataAfterRead(Promise.resolve({ id: 'p1' }))).resolves.toEqual({});
  });

  // The not-found reaches the metadata, so Next.js serves the not-found title of the tab (#404).
  it('throws the not-found of the read on', async () => {
    const notFound = new Error('NEXT_HTTP_ERROR_FALLBACK;404');

    await expect(metadataAfterRead(Promise.reject(notFound))).rejects.toBe(notFound);
  });

  // The page shows `RateLimitedNotice` for a `429`, never the not-found page (#356).
  it('keeps the metadata of the layouts for a person over the rate limit', async () => {
    const rateLimited = new ApiError(429, 'request.rate_limited', [], 30);

    await expect(metadataAfterRead(Promise.reject(rateLimited))).resolves.toEqual({});
  });

  it('throws every other error on, as the page does', async () => {
    const error = new ApiError(500, 'server.internal_error');

    await expect(metadataAfterRead(Promise.reject(error))).rejects.toBe(error);
  });
});
