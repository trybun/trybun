import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './api-error.js';

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
