import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { QueryProvider } from '../lib/query-client/query-provider.js';

// The UI typeface of the brand, self-hosted by Next.js (docs/brand/README.md). `subsets` are the
// preloaded files: every subset keeps its `@font-face` with a `unicode-range`, so the browser
// fetches `latin-ext` (Polish letters) only for a page that uses them. Preloading it too pushed
// the simulated LCP of the empty shell over the budget of §2.9 (#72).
const manrope = Manrope({
  subsets: ['latin'],
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
