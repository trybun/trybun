import { CATALOGUES } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Outside Next.js: no image optimization, only the source of the image.
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <span data-src={src} aria-label={alt} />,
}));

const { PublicHeader } = await import('./public-header.js');

describe('PublicHeader', () => {
  it('shows the brand of Trybun in the banner landmark, without the menus of the shell', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={CATALOGUES.en} timeZone="UTC">
        <PublicHeader />
      </NextIntlClientProvider>,
    );

    expect(html).toContain('<header');
    expect(html).toContain('data-src="/icons/trybun-icon.svg" aria-label=""');
    expect(html).toContain('>Trybun</span>');
    expect(html).not.toContain('<button');
  });
});
