import { vi } from 'vitest';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Reply = { status?: number; data?: unknown; error?: unknown };
type Route = Reply | ((init: unknown) => Reply);

/**
 * A stand-in for the browser API client of `openapi-fetch` (§18.7): answers `METHOD /path` from a
 * route table and records the calls, so a component test sees the requests the user caused.
 */
export function createFakeApiClient() {
  const routes = new Map<string, Route>();
  const calls: { method: Method; path: string; init: unknown }[] = [];

  const request = (method: Method) =>
    vi.fn((path: string, init?: unknown) => {
      calls.push({ method, path, init });
      const route = routes.get(`${method} ${path}`);
      if (route === undefined) {
        throw new Error(`No route for ${method} ${path}`);
      }
      const { status = 200, data, error } = typeof route === 'function' ? route(init) : route;
      const response = new Response(null, { status });
      return Promise.resolve(status >= 400 ? { error, response } : { data, response });
    });

  return {
    client: {
      GET: request('GET'),
      POST: request('POST'),
      PUT: request('PUT'),
      PATCH: request('PATCH'),
      DELETE: request('DELETE'),
    },
    /** Answers `route` (`'POST /api/v1/users/{userId}/deactivation'`) from now on. */
    on(route: string, reply: Route) {
      routes.set(route, reply);
    },
    calls,
    reset() {
      routes.clear();
      calls.length = 0;
    },
    /** The requests of one `METHOD /path`. */
    callsTo(route: string) {
      return calls.filter((call) => `${call.method} ${call.path}` === route);
    },
  };
}
