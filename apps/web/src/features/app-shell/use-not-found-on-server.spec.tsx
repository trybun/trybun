// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.hoisted(() => vi.fn());
// The router of Next.js is the same object on every render.
const router = vi.hoisted(() => ({ refresh }));
vi.mock('next/navigation.js', () => ({ useRouter: () => router }));

const { useNotFoundOnServer } = await import('./use-not-found-on-server.js');
const { ApiError } = await import('../../lib/errors/api-error.js');

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

describe('useNotFoundOnServer', () => {
  // The Server Component reads the record again and calls `notFound()` in its metadata, so the
  // not-found page comes with its translated tab title (#404).
  it('refreshes the route once when the record of the page is gone', () => {
    const { result, rerender } = renderHook(({ error }) => useNotFoundOnServer(error), {
      initialProps: { error: new ApiError(404, 'request.not_found') },
    });

    expect(result.current).toBe(true);
    expect(refresh).toHaveBeenCalledOnce();

    rerender({ error: new ApiError(404, 'request.not_found') });

    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    ['no error', null],
    ['a rate limit', new ApiError(429, 'request.rate_limited', [], 30)],
    ['a failure of the server', new ApiError(500, 'server.internal_error')],
    ['a failure of the network', new TypeError('Failed to fetch')],
  ])('leaves the page as it is on %s', (_, error) => {
    const { result } = renderHook(() => useNotFoundOnServer(error));

    expect(result.current).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });
});
