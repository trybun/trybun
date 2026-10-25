import 'server-only';
import type { UserKind } from '@trybun/contracts/users';

export interface SessionLifetime {
  /** A session without a request for this long ends. */
  idleTimeoutSeconds: number;
  /** A session ends this long after the sign-in, however active. */
  maxLifetimeSeconds: number;
}

/**
 * The session lifetimes of §14.4 by account kind. Keycloak has one session lifetime for the realm,
 * that of end users (`docker/keycloak/realm/trybun.yaml`); the web session ends the sessions of
 * the team earlier, together with their Keycloak session.
 */
export const SESSION_LIFETIMES: Record<UserKind, SessionLifetime> = {
  team: { idleTimeoutSeconds: 30 * 60, maxLifetimeSeconds: 12 * 60 * 60 },
  end_user: { idleTimeoutSeconds: 8 * 60 * 60, maxLifetimeSeconds: 30 * 24 * 60 * 60 },
};

/** The lifetime of a new session; an account whose kind is unknown gets the shortest one. */
export function sessionLifetimeOf(kind: UserKind | undefined): SessionLifetime {
  return SESSION_LIFETIMES[kind ?? 'team'];
}

/** The lifetime columns of a session row. */
export interface SessionExpiry {
  expiresAt: Date;
  idleExpiresAt: Date;
  idleTimeoutSeconds: number;
}

/** The expiry of a session signed in at `now`. */
export function newSessionExpiry(lifetime: SessionLifetime, now: Date): SessionExpiry {
  return {
    expiresAt: new Date(now.getTime() + lifetime.maxLifetimeSeconds * 1_000),
    idleExpiresAt: new Date(now.getTime() + lifetime.idleTimeoutSeconds * 1_000),
    idleTimeoutSeconds: lifetime.idleTimeoutSeconds,
  };
}

export function isSessionExpired(session: SessionExpiry, now: Date): boolean {
  return session.expiresAt <= now || session.idleExpiresAt <= now;
}

/** The idle timeout is moved forward at most once a minute, so most requests write nothing. */
const ACTIVITY_WRITE_INTERVAL_MS = 60_000;

/**
 * The new end of the idle timeout after a request at `now`; `undefined` while the stored one was
 * set less than a minute ago.
 */
export function nextIdleExpiry(session: SessionExpiry, now: Date): Date | undefined {
  const idleTimeoutMs = session.idleTimeoutSeconds * 1_000;
  const lastActivity = session.idleExpiresAt.getTime() - idleTimeoutMs;
  return now.getTime() - lastActivity < ACTIVITY_WRITE_INTERVAL_MS
    ? undefined
    : new Date(now.getTime() + idleTimeoutMs);
}
