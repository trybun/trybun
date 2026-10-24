import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { stdTimeFunctions } from 'pino';
import type { Options } from 'pino-http';
import type { TrybunConfig } from '../config/config.schema.js';

/** A request ID passed by the caller (the web application, Caddy) is kept when it is this safe. */
const REQUEST_ID = /^[\w-]{1,64}$/;

/** The request ID of a request (§17.2): the caller's `X-Request-Id`, else a new UUID; returned in the header. */
export function requestIdOf(request: IncomingMessage, response: ServerResponse): string {
  const header = request.headers['x-request-id'];
  const id = typeof header === 'string' && REQUEST_ID.test(header) ? header : randomUUID();
  response.setHeader('X-Request-Id', id);
  return id;
}

/**
 * What a log may contain of a request (§17.2): its method; the route template is added when the
 * request completes (`withRoute`). Never the URL with its query, the headers, cookies or the body.
 */
export function serializeRequest(request: { method: string }): Record<string, unknown> {
  return { method: request.method };
}

/**
 * Adds the route template of the handler to the line of a completed request. It is known only
 * after routing, while the request is bound to its logger before.
 */
export function withRoute(
  request: IncomingMessage & { route?: { path?: unknown } },
  _response: ServerResponse,
  value: object,
): object {
  const route = request.route?.path;
  return typeof route === 'string' ? { ...value, route } : value;
}

export function serializeResponse(response: { statusCode: number }): Record<string, unknown> {
  return { statusCode: response.statusCode };
}

/**
 * An error without its message, which may quote personal data or content (e.g. an invalid value
 * in a database error, §17.2): its type, code and stack frames.
 */
export function serializeError(error: unknown): Record<string, unknown> {
  if (typeof error !== 'object' || error === null) {
    return { type: typeof error };
  }
  // pino-http passes errors through the standard serializer first, which keeps `type` and `stack`.
  const { type, name, code, stack } = error as Record<string, unknown>;
  const frames = (typeof stack === 'string' ? stack : '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '));
  return {
    type: typeof type === 'string' ? type : typeof name === 'string' ? name : 'Error',
    ...(typeof code === 'string' || typeof code === 'number' ? { code: String(code) } : {}),
    stack: frames.join('\n'),
  };
}

/**
 * The JSON logs of the API and the Worker (§17.2): level, ISO time and the request ID of every
 * line logged during a request; one line per completed request, except the health checks.
 */
export function loggerOptions(config: TrybunConfig): Options<IncomingMessage, ServerResponse> {
  return {
    level: config.logLevel,
    timestamp: stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    genReqId: requestIdOf,
    customAttributeKeys: { reqId: 'requestId' },
    quietReqLogger: true,
    autoLogging: { ignore: (request) => request.url?.startsWith('/health') === true },
    customSuccessObject: withRoute,
    customErrorObject: (request, response, _error, value: object) =>
      withRoute(request, response, value),
    serializers: { req: serializeRequest, res: serializeResponse, err: serializeError },
  };
}
