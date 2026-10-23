import 'server-only';
import { hkdfSync } from 'node:crypto';
import { CompactEncrypt, compactDecrypt } from 'jose';

/** Encryption of the Keycloak tokens stored in the session row (§14.4). */
export interface TokenCipher {
  encrypt(token: string): Promise<string>;
  decrypt(encrypted: string): Promise<string>;
}

/** JWE with AES-256-GCM and a key derived from `AUTH_SECRET` (HKDF-SHA-256). */
export function createTokenCipher(secret: string): TokenCipher {
  const key = new Uint8Array(hkdfSync('sha256', secret, '', 'Trybun session tokens', 32));
  return {
    encrypt: (token) =>
      new CompactEncrypt(new TextEncoder().encode(token))
        .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
        .encrypt(key),
    async decrypt(encrypted) {
      const { plaintext } = await compactDecrypt(encrypted, key, {
        keyManagementAlgorithms: ['dir'],
        contentEncryptionAlgorithms: ['A256GCM'],
      });
      return new TextDecoder().decode(plaintext);
    },
  };
}
