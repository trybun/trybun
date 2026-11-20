/**
 * The answer of the server API client (`openapi-fetch`) to a request over the rate limit (§14.4):
 * `429` with the Problem Details of `request.rate_limited` and a wait of 45 seconds.
 */
export function rateLimitedResult() {
  return Promise.resolve({
    error: {
      type: 'about:blank',
      title: 'Too Many Requests',
      status: 429,
      code: 'request.rate_limited',
    },
    response: new Response(null, { status: 429, headers: { 'Retry-After': '45' } }),
  });
}
