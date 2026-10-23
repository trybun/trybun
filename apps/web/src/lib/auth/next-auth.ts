import 'server-only';
import nextAuthModule from 'next-auth';
import keycloakProviderModule from 'next-auth/providers/keycloak';

/**
 * The default export of a CommonJS module compiled from ES modules (`exports.default` with
 * `__esModule`): TypeScript (`nodenext`) types the default import as the whole module, while
 * Next.js (Turbopack) resolves it to `exports.default`.
 */
function interopDefault<T>(module: { default: T }): T {
  return typeof module === 'function' ? module : module.default;
}

/** The two default exports of Auth.js 4 that the web application uses. */
export const NextAuth = interopDefault(nextAuthModule);
export const KeycloakProvider = interopDefault(keycloakProviderModule);
