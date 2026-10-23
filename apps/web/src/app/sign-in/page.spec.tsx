import { describe, expect, it, vi } from 'vitest';

const redirect = vi.fn((url: string) => {
  throw new Error(`redirect ${url}`);
});
vi.mock('next/navigation.js', () => ({ redirect }));

const { default: SignInPage } = await import('./page.js');
const { SignInRedirect } = await import('../../features/sessions/components/sign-in-redirect.js');

describe('SignInPage', () => {
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
});
