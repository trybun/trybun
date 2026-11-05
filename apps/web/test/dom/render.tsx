import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CATALOGUES, type Locale } from '@trybun/i18n/catalogues';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';

/** Renders `element` in the DOM with the providers of the application: messages and queries. */
export function renderInApp(
  element: ReactElement,
  {
    locale = 'en',
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }: { locale?: Locale; client?: QueryClient } = {},
) {
  return {
    client,
    ...render(
      <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]} timeZone="UTC">
        <QueryClientProvider client={client}>{element}</QueryClientProvider>
      </NextIntlClientProvider>,
    ),
  };
}
