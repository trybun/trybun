import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
  getLocale: () => Promise.resolve('pl'),
  getTranslations: (namespace: string) => Promise.resolve((key: string) => `${namespace}.${key}`),
}));
// The provider passes the texts of the request to client components (a Server Component in Next.js).
function PassThroughProvider({ children }: { children: ReactNode }) {
  return children;
}
vi.mock('next-intl', () => ({ NextIntlClientProvider: PassThroughProvider }));
// The font loader of Next.js replaces the call at build time.
vi.mock('next/font/google', () => ({ Manrope: () => ({ variable: 'font-manrope' }) }));

const { default: RootLayout, generateMetadata } = await import('./layout.js');

describe('RootLayout', () => {
  it('renders the page inside the document in the language of the request', async () => {
    expect(
      renderToStaticMarkup(
        await RootLayout({
          children: <main />,
        }),
      ),
    ).toBe('<html lang="pl" class="font-manrope"><head></head><body><main></main></body></html>');
  });

  it('takes the title from the messages', async () => {
    expect(await generateMetadata()).toEqual({
      title: 'app.title',
      appleWebApp: { title: 'app.title' },
    });
  });
});
