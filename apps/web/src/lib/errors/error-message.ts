import { errorCodeSchema } from '@trybun/contracts/errors';
import { type FieldErrorCode, fieldErrorCodeSchema } from '@trybun/contracts/problem-details';
import { useTranslations } from 'next-intl';
import { ApiError } from './api-error.js';

const codeSchema = errorCodeSchema.or(fieldErrorCodeSchema);

/** The messages of a form field that name it, by field error code (§18.5). */
export type FieldMessages = Partial<Record<FieldErrorCode, string>>;

/**
 * The message of an error in the user's language (§17.2): `errors.<code>` of an `ApiError`, an
 * error code or a field error code (`errors[].code`); any other error shows the message of an
 * unexpected error, never its raw text. The type check requires a message for every code. A form
 * field passes its own messages for codes that read better with its name (§18.5), e.g. "Enter
 * your first name" for an empty required text.
 */
export function useErrorMessage(): (error: unknown, fieldMessages?: FieldMessages) => string {
  const t = useTranslations('errors');
  return (error, fieldMessages) => {
    const code = codeSchema.safeParse(error instanceof ApiError ? error.code : error);
    if (!code.success) {
      return t('server.internal_error');
    }
    const fieldCode = fieldErrorCodeSchema.safeParse(code.data);
    return (fieldCode.success ? fieldMessages?.[fieldCode.data] : undefined) ?? t(code.data);
  };
}
