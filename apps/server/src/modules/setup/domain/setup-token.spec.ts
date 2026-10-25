import { describe, expect, it } from 'vitest';
import { hashSetupToken, setupLink, setupTokenExpiry } from './setup-token.js';

describe('setup token', () => {
  it('stores the SHA-256 of the token in base64url', () => {
    expect(hashSetupToken('token')).toBe('PEaenWxYddN6Q_NT1PiOYfz4EsZu7jRXRlpAsNpBU-A');
  });

  it('expires 24 hours after it is issued', () => {
    expect(setupTokenExpiry(new Date('2026-10-25T10:00:00Z'))).toEqual(
      new Date('2026-10-26T10:00:00Z'),
    );
  });

  it('carries the token in the fragment of the link', () => {
    expect(setupLink('trybun.example.com', 'abc')).toBe(
      'https://trybun.example.com/setup#token=abc',
    );
  });
});
