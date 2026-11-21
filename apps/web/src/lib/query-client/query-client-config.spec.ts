import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors/api-error.js';
import { BROWSER_QUERY_CLIENT_CONFIG, retryUnlessRefused } from './query-client-config.js';

describe('retryUnlessRefused', () => {
  it.each([
    [new ApiError(404, 'request.not_found'), false],
    [new ApiError(429, 'request.rate_limited', [], 30), false],
    [new ApiError(500, 'server.internal_error'), true],
    [new ApiError(503, 'server.unavailable'), true],
    [new TypeError('Failed to fetch'), true],
  ])('retries a read that failed with %o: %s', (error, isRetried) => {
    expect(retryUnlessRefused(0, error)).toBe(isRetried);
  });

  it('gives up on a failure of the server after 3 retries', () => {
    const error = new ApiError(503, 'server.unavailable');
    expect(retryUnlessRefused(2, error)).toBe(true);
    expect(retryUnlessRefused(3, error)).toBe(false);
  });
});

describe('the query client of the browser', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** The calls of a read observed like a component does, once it has settled. */
  async function callsOfObservedRead(error: Error) {
    vi.useFakeTimers();
    const queryFn = vi.fn(() => Promise.reject(error));
    const observer = new QueryObserver(new QueryClient(BROWSER_QUERY_CLIENT_CONFIG), {
      queryKey: ['read'],
      queryFn,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    // Long enough for every retry of TanStack Query's default delays (1 s, 2 s, 4 s).
    await vi.advanceTimersByTimeAsync(10_000);
    const result = observer.getCurrentResult();
    unsubscribe();
    return { calls: queryFn.mock.calls.length, result };
  }

  it('shows a refused read (429) at once, without a retry (#427)', async () => {
    const { calls, result } = await callsOfObservedRead(
      new ApiError(429, 'request.rate_limited', [], 30),
    );

    expect(calls).toBe(1);
    expect(result.isError).toBe(true);
  });

  it('tries a failure of the server again', async () => {
    const { calls } = await callsOfObservedRead(new ApiError(503, 'server.unavailable'));

    expect(calls).toBe(4);
  });
});
