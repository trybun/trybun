import { describe, expect, it } from 'vitest';
import { keycloakAuthorizationParams } from './keycloak-sign-in.js';

describe('keycloakAuthorizationParams', () => {
  it('passes the language of the Keycloak screens', () => {
    expect(keycloakAuthorizationParams({ locale: 'pl' })).toEqual({ ui_locales: 'pl' });
  });

  it('pre-fills the address of a password sign-in', () => {
    expect(keycloakAuthorizationParams({ locale: 'en', loginHint: 'anna@firma.pl' })).toEqual({
      ui_locales: 'en',
      login_hint: 'anna@firma.pl',
    });
  });

  it('marks a provider sign-in of an invitation with the scope `invitation` (ADR 0009)', () => {
    expect(
      keycloakAuthorizationParams({ locale: 'en', identityProvider: 'github', isInvitation: true }),
    ).toEqual({ ui_locales: 'en', kc_idp_hint: 'github', scope: 'openid invitation' });
  });

  it('keeps the default scope of a sign-in without an invitation', () => {
    expect(keycloakAuthorizationParams({ locale: 'en', identityProvider: 'github' })).toEqual({
      ui_locales: 'en',
      kc_idp_hint: 'github',
    });
  });
});
