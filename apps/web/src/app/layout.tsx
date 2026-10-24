import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { QueryProvider } from '../lib/query-client/query-provider.js';

// The UI typeface of the brand, self-hosted by Next.js (docs/brand/README.md).
const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-manrope',
  display: 'swap',
});

export const viewport: Viewport = {
  // The safe areas of phones with a notch or a home indicator (§2.9).
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return { title: t('title'), appleWebApp: { title: t('title') } };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={manrope.variable}>
      <body>
        <NextIntlClientProvider>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
