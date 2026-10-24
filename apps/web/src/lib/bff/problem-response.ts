import { STATUS_CODES } from 'node:http';
import { ERROR_HTTP_STATUS, type ErrorCode } from '@trybun/contracts/errors';
import type { ProblemDetails } from '@trybun/contracts/problem-details';

/** An error of the BFF itself as Problem Details, like the errors of the API (§17.2). */
export function problemResponse(code: ErrorCode): Response {
  const status = ERROR_HTTP_STATUS[code];
  const problem: ProblemDetails = {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    code,
  };
  return Response.json(problem, {
    status,
    headers: { 'Content-Type': 'application/problem+json', 'Cache-Control': 'no-store' },
  });
}
