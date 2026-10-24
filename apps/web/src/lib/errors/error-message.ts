import { errorCodeSchema } from '@trybun/contracts/errors';
import { fieldErrorCodeSchema } from '@trybun/contracts/problem-details';
import { useTranslations } from 'next-intl';
import { ApiError } from './api-error.js';

const codeSchema = errorCodeSchema.or(fieldErrorCodeSchema);

/**
 * The message of an error in the user's language (§17.2): `errors.<code>` of an `ApiError`, an
 * error code or a field error code (`errors[].code`); any other error shows the message of an
 * unexpected error, never its raw text. The type check requires a message for every code.
 */
export function useErrorMessage(): (error: unknown) => string {
  const t = useTranslations('errors');
  return (error) => {
    const code = codeSchema.safeParse(error instanceof ApiError ? error.code : error);
    return t(code.success ? code.data : 'server.internal_error');
  };
}
