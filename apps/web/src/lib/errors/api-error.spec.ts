import { describe, expect, it } from 'vitest';
import { ApiError, isRateLimited, retryAfterSecondsOf, toApiError } from './api-error.js';

function problemResponse(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

describe('toApiError', () => {
  it('keeps the code and the invalid fields of Problem Details', async () => {
    const error = await toApiError(
      problemResponse(422, {
        type: 'about:blank',
        title: 'Unprocessable Content',
        status: 422,
        code: 'request.validation_failed',
        errors: [{ pointer: '/title', code: 'string.too_long' }],
      }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'request.validation_failed',
      fieldErrors: [{ pointer: '/title', code: 'string.too_long' }],
    });
  });

  it.each([
    [
      'a body that is not JSON',
      new Response('<html>Bad Gateway</html>', { status: 502 }),
      'server.unavailable',
    ],
    [
      'an unknown code',
      problemResponse(418, { type: 'about:blank', title: 'Teapot', status: 418, code: 'teapot' }),
      'server.internal_error',
    ],
    ['an empty body', new Response(null, { status: 500 }), 'server.internal_error'],
  ])('falls back to a generic code for %s', async (_case, response, code) => {
    const error = await toApiError(response);

    expect(error).toMatchObject({ status: response.status, code, fieldErrors: [] });
  });
});

describe('the wait of Retry-After (RFC 9110, section 10.2.3)', () => {
  const now = Date.parse('2026-11-18T12:00:00.000Z');

  it('keeps the seconds of a rate-limited response', async () => {
    const response = Response.json(
      {
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        code: 'request.rate_limited',
      },
      { status: 429, headers: { 'Retry-After': '45' } },
    );

    const error = await toApiError(response);

    expect(error).toMatchObject({ code: 'request.rate_limited', retryAfterSeconds: 45 });
    expect(isRateLimited(error)).toBe(true);
  });

  it('keeps the wait of a response that is not Problem Details', async () => {
    const error = await toApiError(
      new Response(null, { status: 503, headers: { 'Retry-After': '120' } }),
    );

    expect(error).toMatchObject({ code: 'server.unavailable', retryAfterSeconds: 120 });
    expect(isRateLimited(error)).toBe(false);
  });

  it.each([
    ['delay-seconds', '30', 30],
    ['delay-seconds with surrounding whitespace', ' 30 ', 30],
    ['no wait', '0', 0],
    ['an HTTP-date', 'Wed, 18 Nov 2026 12:01:30 GMT', 90],
    ['an HTTP-date with a fraction of a second left', 'Wed, 18 Nov 2026 12:00:01 GMT', 1],
    ['an HTTP-date in the past', 'Wed, 18 Nov 2026 11:59:00 GMT', 0],
    ['an obsolete RFC 850 date', 'Wednesday, 18-Nov-26 12:01:00 GMT', 60],
    ['an obsolete asctime date', 'Wed Nov 18 12:02:00 2026', 120],
    ['an asctime date with a one-digit day', 'Wed Dec  2 12:00:00 2026', 14 * 24 * 60 * 60],
    ['a date that does not exist', 'Mon, 31 Feb 2026 12:00:00 GMT', undefined],
    ['a time that does not exist', 'Wed, 18 Nov 2026 25:00:00 GMT', undefined],
    ['a date in another time zone', 'Wed, 18 Nov 2026 13:00:00 +0100', undefined],
    ['an ISO 8601 date', '2026-11-18T12:01:00Z', undefined],
    ['the longest wait a date can show', '4320000000000', 4_320_000_000_000],
    ['a wait no date can show', '99999999999999999999999', undefined],
    ['no header', null, undefined],
    ['a negative number', '-5', undefined],
    ['a fraction', '1.5', undefined],
    ['text', 'soon', undefined],
  ])('reads %s', (_case, value, seconds) => {
    expect(retryAfterSecondsOf(value, now)).toBe(seconds);
  });

  it('is not a rate limit for other errors', () => {
    expect(isRateLimited(new ApiError(404, 'request.not_found'))).toBe(false);
    expect(isRateLimited(new Error('request.rate_limited'))).toBe(false);
  });
});
