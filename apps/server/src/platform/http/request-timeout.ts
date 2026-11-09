import type { Server } from 'node:http';

/**
 * The time the API gives a client to send a whole request (§13.3): 30 minutes, so the largest
 * upload (100 MB, the upper bound of `TRYBUN_ATTACHMENT_MAX_SIZE_MB`) still arrives at 0.5 Mbit/s.
 * Node's default of 5 minutes would cut it below about 2.8 Mbit/s.
 */
export const REQUEST_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Sets the request timeout of the API's HTTP server. The headers timeout keeps Node's default, so
 * a client that sends its headers slowly (slowloris) is still cut off early.
 */
export function applyRequestTimeout(server: Server): void {
  server.requestTimeout = REQUEST_TIMEOUT_MS;
}
