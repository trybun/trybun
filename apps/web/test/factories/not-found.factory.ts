/**
 * The answer of the server API client (`openapi-fetch`) for a record that does not exist or that
 * the person may not see (§14.4): `404` with the Problem Details of `request.not_found`.
 */
export function notFoundResult() {
  return Promise.resolve({
    error: { type: 'about:blank', title: 'Not Found', status: 404, code: 'request.not_found' },
    response: new Response(null, { status: 404 }),
  });
}
