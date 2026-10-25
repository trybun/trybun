import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.fn((url: string) => {
  throw new Error(`redirect ${url}`);
});
vi.mock('next/navigation.js', () => ({ redirect }));

const getSetup = vi.fn();
vi.mock('../../lib/api-client/server-api-client.js', () => ({
  getServerApiClient: () => Promise.resolve({ GET: getSetup }),
}));

const { default: SignInPage } = await import('./page.js');
const { SignInRedirect } = await import('../../features/sessions/components/sign-in-redirect.js');
const { SetupPendingNotice } =
  await import('../../features/setup/components/setup-pending-notice.js');

describe('SignInPage', () => {
  beforeEach(() => {
    getSetup.mockResolvedValue({ data: { status: 'completed' } });
  });

  it.each([
    [{ callbackUrl: '/tickets?view=board' }, '/tickets?view=board'],
    [{}, '/'],
    [{ callbackUrl: 'https://evil.example.com/' }, '/'],
    [{ callbackUrl: '//evil.example.com/' }, '/'],
  ])('starts the sign-in for %j returning to %s', async (searchParams, callbackUrl) => {
    const page = await SignInPage({ searchParams: Promise.resolve(searchParams) });

    expect(page.type).toBe(SignInRedirect);
    expect(page.props).toEqual({ callbackUrl });
  });

  it('shows the error of a failed sign-in instead of starting it again', async () => {
    await expect(
      SignInPage({ searchParams: Promise.resolve({ error: 'AccessDenied' }) }),
    ).rejects.toThrow('redirect /api/auth/error?error=AccessDenied');
  });

  it('points to the setup link while no Administrator exists', async () => {
    getSetup.mockResolvedValue({ data: { status: 'available' } });

    const page = await SignInPage({ searchParams: Promise.resolve({}) });

    expect(page.type).toBe(SetupPendingNotice);
  });

  it('starts the sign-in when the API is unavailable', async () => {
    getSetup.mockRejectedValue(new Error('connection refused'));

    const page = await SignInPage({ searchParams: Promise.resolve({}) });

    expect(page.type).toBe(SignInRedirect);
  });
});
