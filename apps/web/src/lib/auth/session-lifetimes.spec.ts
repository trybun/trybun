import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

vi.mock('server-only', () => ({}));

const { isSessionExpired, newSessionExpiry, nextIdleExpiry, SESSION_LIFETIMES, sessionLifetimeOf } =
  await import('./session-lifetimes.js');

const SIGN_IN = new Date('2026-11-03T09:00:00.000Z');
const minutes = (count: number) => new Date(SIGN_IN.getTime() + count * 60_000);

describe('session lifetimes', () => {
  it('are those of §14.4 for each account kind', () => {
    expect(SESSION_LIFETIMES).toEqual({
      team: { idleTimeoutSeconds: 1_800, maxLifetimeSeconds: 43_200 },
      end_user: { idleTimeoutSeconds: 28_800, maxLifetimeSeconds: 2_592_000 },
    });
  });

  it('of end users are the session lifetimes of the Keycloak realm', () => {
    const realm = parse(
      readFileSync(
        join(import.meta.dirname, '../../../../../docker/keycloak/realm/trybun.yaml'),
        'utf8',
      ),
    ) as { ssoSessionIdleTimeout: number; ssoSessionMaxLifespan: number };

    expect(realm.ssoSessionIdleTimeout).toBe(SESSION_LIFETIMES.end_user.idleTimeoutSeconds);
    expect(realm.ssoSessionMaxLifespan).toBe(SESSION_LIFETIMES.end_user.maxLifetimeSeconds);
  });

  it('are the shortest for an account of unknown kind', () => {
    expect(sessionLifetimeOf(undefined)).toBe(SESSION_LIFETIMES.team);
  });
});

describe('session expiry', () => {
  const team = newSessionExpiry(SESSION_LIFETIMES.team, SIGN_IN);

  it('ends an idle team session after 30 minutes', () => {
    expect(isSessionExpired(team, minutes(29))).toBe(false);
    expect(isSessionExpired(team, minutes(30))).toBe(true);
  });

  it('moves the idle timeout forward with a request, at most once a minute', () => {
    expect(nextIdleExpiry(team, minutes(0.5))).toBeUndefined();
    expect(nextIdleExpiry(team, minutes(20))).toEqual(minutes(50));
  });

  it('ends an active team session after 12 hours', () => {
    const active = { ...team, idleExpiresAt: minutes(12 * 60 + 25) };

    expect(isSessionExpired(active, minutes(12 * 60 - 1))).toBe(false);
    expect(isSessionExpired(active, minutes(12 * 60))).toBe(true);
  });

  it('keeps an end-user session idle for up to 8 hours', () => {
    const endUser = newSessionExpiry(SESSION_LIFETIMES.end_user, SIGN_IN);

    expect(isSessionExpired(endUser, minutes(8 * 60 - 1))).toBe(false);
    expect(isSessionExpired(endUser, minutes(8 * 60))).toBe(true);
  });
});
