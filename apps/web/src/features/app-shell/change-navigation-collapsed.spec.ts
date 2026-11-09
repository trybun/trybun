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
}));
for (const [name, value] of Object.entries(TEST_ENV)) {
  vi.stubEnv(name, value);
}

const { changeNavigationCollapsed } = await import('./change-navigation-collapsed.js');
const { isNavigationCollapsed } = await import('./navigation-cookie.js');

describe('changeNavigationCollapsed', () => {
  beforeEach(() => {
    browserCookies.clear();
  });

  it('is expanded without a stored choice', async () => {
    expect(await isNavigationCollapsed()).toBe(false);
  });

  it('remembers the collapsed navigation for a year in this browser', async () => {
    await changeNavigationCollapsed(true);

    expect(await isNavigationCollapsed()).toBe(true);
    expect(browserCookies.get('TRYBUN_NAVIGATION_COLLAPSED')).toMatchObject({
      value: '1',
      options: { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 365 * 24 * 60 * 60 },
    });
  });

  it('removes the cookie when the navigation is expanded again', async () => {
    await changeNavigationCollapsed(true);
    await changeNavigationCollapsed(false);

    expect(browserCookies.has('TRYBUN_NAVIGATION_COLLAPSED')).toBe(false);
    expect(await isNavigationCollapsed()).toBe(false);
  });

  it('treats any other cookie value as expanded', async () => {
    browserCookies.set('TRYBUN_NAVIGATION_COLLAPSED', { value: 'yes', options: {} });

    expect(await isNavigationCollapsed()).toBe(false);
  });

  it('rejects an argument that is no boolean', async () => {
    await expect(changeNavigationCollapsed('true' as unknown as boolean)).rejects.toThrow();
    expect(browserCookies.size).toBe(0);
  });
});
