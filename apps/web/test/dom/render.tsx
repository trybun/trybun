import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RequestLocale } from '@trybun/i18n/pseudo';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { messagesOf } from '../messages.js';

/** Renders `element` in the DOM with the providers of the application: messages and queries. */
export function renderInApp(
  element: ReactElement,
  {
    locale = 'en',
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }: { locale?: RequestLocale; client?: QueryClient } = {},
) {
  return {
    client,
    ...render(
      <NextIntlClientProvider locale={locale} messages={messagesOf(locale)} timeZone="UTC">
        <QueryClientProvider client={client}>{element}</QueryClientProvider>
      </NextIntlClientProvider>,
    ),
  };
}
