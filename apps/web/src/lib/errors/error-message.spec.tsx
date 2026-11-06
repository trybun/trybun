import { CATALOGUES, LOCALES } from '@trybun/i18n/catalogues';
import { errorCodeSchema } from '@trybun/contracts/errors';
import { fieldErrorCodeSchema } from '@trybun/contracts/problem-details';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getWebMessages } from '../i18n/messages.js';
import { ApiError } from './api-error.js';
import { type FieldMessages, useErrorMessage } from './error-message.js';

function ErrorMessage({ error, fieldMessages }: { error: unknown; fieldMessages?: FieldMessages }) {
  const errorMessage = useErrorMessage();
  return <p role="alert">{errorMessage(error, fieldMessages)}</p>;
}

/** The message shown for an error in a language; a missing message fails the render. */
function messageOf(
  error: unknown,
  locale: keyof typeof CATALOGUES = 'en',
  fieldMessages?: FieldMessages,
): string {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={getWebMessages(locale)}
      timeZone="UTC"
      onError={(intlError) => {
        throw intlError;
      }}
    >
      <ErrorMessage error={error} fieldMessages={fieldMessages} />
    </NextIntlClientProvider>,
  );
  return html.replace(/^<p role="alert">|<\/p>$/g, '');
}

describe('useErrorMessage', () => {
  it('shows the standard conflict message for a stale version (§17.2)', () => {
    const error = new ApiError(412, 'request.precondition_failed');

    expect(messageOf(error, 'en')).toBe(
      'This item was changed by someone else – reload to see the latest version',
    );
    expect(messageOf(error, 'pl')).toBe(
      'Ten element został zmieniony przez kogoś innego – odśwież, aby zobaczyć najnowszą wersję',
    );
  });

  it('translates a field error code', () => {
    expect(messageOf('string.too_long')).toBe('Too long');
  });

  // A required field names itself (§18.5); other codes keep their common message.
  it('shows the message of a field for its codes', () => {
    const fieldMessages = { 'string.empty': 'Enter your first name' };

    expect(messageOf('string.empty', 'en', fieldMessages)).toBe('Enter your first name');
    expect(messageOf('string.too_long', 'en', fieldMessages)).toBe('Too long');
    expect(messageOf('string.empty')).toBe('Required');
    expect(messageOf('teapot.brewing', 'en', fieldMessages)).toBe(
      'Something went wrong. Try again later.',
    );
  });

  it.each([
    ['an error without a code', new Error('connect ECONNREFUSED 10.0.0.3:3001')],
    ['an unknown code', 'teapot.brewing'],
  ])('never shows the raw text of %s', (_case, error) => {
    expect(messageOf(error)).toBe('Something went wrong. Try again later.');
  });

  describe.each(LOCALES)('%s', (locale) => {
    it.each([...errorCodeSchema.options, ...fieldErrorCodeSchema.options])(
      'has a message for %s',
      (code) => {
        expect(messageOf(code, locale)).not.toBe('');
      },
    );
  });
});
