import type { NextRequest } from 'next/server.js';
import { getBffProxy } from '../../../../lib/bff/get-bff-proxy.js';

/**
 * The BFF endpoint (§14.4): every path under `/api/v1/` goes to the same path of the API, which
 * is not exposed publicly.
 */
function handle(request: NextRequest): Promise<Response> {
  return getBffProxy()(request);
}

export {
  handle as DELETE,
  handle as GET,
  handle as HEAD,
  handle as PATCH,
  handle as POST,
  handle as PUT,
};
