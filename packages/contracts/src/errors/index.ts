import { z } from 'zod';

/** The closed list of error codes of the API (§17.1, §17.2). */
export const errorCodeSchema = z.enum(['request.validation_failed']);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** HTTP status of each error code. */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  'request.validation_failed': 422,
};
