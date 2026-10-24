import { CATALOGUES, LOCALES } from '@trybun/i18n/catalogues';
import { errorCodeSchema } from '@trybun/contracts/errors';
import { fieldErrorCodeSchema } from '@trybun/contracts/problem-details';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getWebMessages } from '../i18n/messages.js';
import { ApiError } from './api-error.js';
import { useErrorMessage } from './error-message.js';

function ErrorMessage({ error }: { error: unknown }) {
  const errorMessage = useErrorMessage();
  return <p role="alert">{errorMessage(error)}</p>;
}

/** The message shown for an error in a language; a missing message fails the render. */
function messageOf(error: unknown, locale: keyof typeof CATALOGUES = 'en'): string {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={getWebMessages(locale)}
      timeZone="UTC"
      onError={(intlError) => {
        throw intlError;
      }}
    >
      <ErrorMessage error={error} />
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
