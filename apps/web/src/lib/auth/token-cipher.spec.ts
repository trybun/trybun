import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { createTokenCipher } = await import('./token-cipher.js');

const SECRET = 'a-test-secret-of-at-least-32-characters';
const TOKEN = 'eyJhbGciOiJSUzI1NiJ9.payload.signature';

describe('createTokenCipher', () => {
  it('decrypts what it encrypted', async () => {
    const cipher = createTokenCipher(SECRET);

    await expect(cipher.decrypt(await cipher.encrypt(TOKEN))).resolves.toBe(TOKEN);
  });

  it('never stores the token in plain text and encrypts it differently every time', async () => {
    const cipher = createTokenCipher(SECRET);

    const [first, second] = await Promise.all([cipher.encrypt(TOKEN), cipher.encrypt(TOKEN)]);

    expect(first).not.toContain('payload');
    expect(first).not.toBe(second);
  });

  it('cannot decrypt with another secret', async () => {
    const encrypted = await createTokenCipher(SECRET).encrypt(TOKEN);

    await expect(
      createTokenCipher('another-secret-of-at-least-32-characters').decrypt(encrypted),
    ).rejects.toThrow();
  });
});
