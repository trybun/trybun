/**
 * The proxies whose `X-Forwarded-For` the API trusts for the client IP (§14.4): the internal
 * networks of Compose – Caddy and the BFF of the web application – and the host itself in the
 * local environment. Express then takes the client IP from the nearest untrusted address.
 */
export const TRUSTED_PROXIES = 'loopback, linklocal, uniquelocal';
