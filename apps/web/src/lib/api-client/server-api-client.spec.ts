import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';

vi.mock('server-only', () => ({}));
const getAccessToken = vi.fn<() => Promise<string | undefined>>();
vi.mock('../auth/session.js', () => ({ getAccessToken }));
for (const [name, value] of Object.entries(TEST_ENV)) {
  vi.stubEnv(name, value);
}

const { getServerApiClient } = await import('./server-api-client.js');

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
});
