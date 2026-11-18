// @vitest-environment jsdom
import { PSEUDO_LOCALE } from '@trybun/i18n/pseudo';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../../../test/dom/render.js';

const signIn = vi.hoisted(() => vi.fn());
vi.mock('next-auth/react', () => ({ signIn }));

const { SignInRedirect } = await import('./sign-in-redirect.js');

afterEach(() => {
  cleanup();
  signIn.mockClear();
});

describe('SignInRedirect', () => {
  it('passes the language of the page to Keycloak (§13.1)', () => {
    renderInApp(<SignInRedirect callbackUrl="/tickets" />, { locale: 'pl' });

    expect(signIn).toHaveBeenCalledWith(
      'keycloak',
      { callbackUrl: '/tickets' },
      { ui_locales: 'pl' },
    );
  });

  it('passes English, never the pseudo-locale of the tests, which Keycloak does not know', () => {
    renderInApp(<SignInRedirect callbackUrl="/tickets" />, { locale: PSEUDO_LOCALE });

    expect(signIn).toHaveBeenCalledWith(
      'keycloak',
      { callbackUrl: '/tickets' },
      { ui_locales: 'en' },
    );
  });
});
