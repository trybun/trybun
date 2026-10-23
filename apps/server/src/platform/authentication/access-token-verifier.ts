/** The claims of a valid access token that the API uses: the user and the sign-in methods. */
export interface AccessTokenClaims {
  /** The `sub` of the Keycloak user. */
  sub: string;
  /** Authentication methods of the sign-in (`amr`, RFC 8176), e.g. `pwd`, `otp`. */
  amr: string[];
}

/** Verifies access tokens of the identity provider (§14.4), an external service (§18.3). */
export interface AccessTokenVerifier {
  /** The claims of a valid token; `undefined` for an invalid, expired or foreign token. */
  verify(token: string): Promise<AccessTokenClaims | undefined>;
}

export const ACCESS_TOKEN_VERIFIER = Symbol('AccessTokenVerifier');
