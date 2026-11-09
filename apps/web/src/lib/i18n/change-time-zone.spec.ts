import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';

vi.mock('server-only', () => ({}));

/** The cookies of the browser, as the request carries them and the response sets them. */
const browserCookies = new Map<string, { value: string; options: unknown }>();
vi.mock('next/headers.js', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => browserCookies.get(name),
      set: (name: string, value: string, options: unknown) =>
        browserCookies.set(name, { value, options }),
      delete: (name: string) => browserCookies.delete(name),
    }),
  headers: () => Promise.resolve(new Headers({ 'accept-language': 'en' })),
}));
// Vitest resolves the client build of next-intl; on the server, the function returns its argument.
vi.mock('next-intl/server', () => ({ getRequestConfig: <T>(create: T) => create }));
const refresh = vi.fn();
vi.mock('next/cache.js', () => ({ refresh }));
for (const [name, value] of Object.entries(TEST_ENV)) {
  vi.stubEnv(name, value);
}

const { changeTimeZone } = await import('./change-time-zone.js');
const { default: getRequestConfig } = await import('./request.js');

async function requestTimeZone(): Promise<string | undefined> {
  const config = await getRequestConfig({ requestLocale: Promise.resolve(undefined) });
  return config.timeZone;
}

describe('changeTimeZone', () => {
  beforeEach(() => {
    browserCookies.clear();
    refresh.mockClear();
  });

  it('formats dates in the time zone of the account at once', async () => {
    expect(await requestTimeZone()).toBe('UTC');

    await changeTimeZone('Europe/Warsaw');

    expect(refresh).toHaveBeenCalledOnce();
    expect(await requestTimeZone()).toBe('Europe/Warsaw');
    expect(browserCookies.get('TRYBUN_TIME_ZONE')?.options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
    });
  });

  it('returns to the system default time zone', async () => {
    await changeTimeZone('Europe/Warsaw');
    await changeTimeZone(null);

    expect(browserCookies.has('TRYBUN_TIME_ZONE')).toBe(false);
    expect(await requestTimeZone()).toBe('UTC');
  });

  it('ignores a cookie that is no time zone', async () => {
    browserCookies.set('TRYBUN_TIME_ZONE', { value: 'Mars/Olympus_Mons', options: {} });

    expect(await requestTimeZone()).toBe('UTC');
  });
});
