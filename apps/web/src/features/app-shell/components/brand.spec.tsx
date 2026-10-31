import { CATALOGUES } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Outside Next.js: no image optimization, only the source of the image.
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <span data-src={src} aria-label={alt} />,
}));

const { Brand } = await import('./brand.js');

function render(wordmarkClassName?: string) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={CATALOGUES.en} timeZone="UTC">
      <Brand wordmarkClassName={wordmarkClassName} />
    </NextIntlClientProvider>,
  );
}

describe('Brand', () => {
  it('shows the icon of Trybun and its wordmark', () => {
    const html = render();

    expect(html).toContain('data-src="/icons/trybun-icon.svg" aria-label=""');
    expect(html).toContain('<span class="text-lg font-extrabold lowercase">Trybun</span>');
  });

  it('lets a header hide the wordmark on phones', () => {
    expect(render('sr-only md:not-sr-only')).toContain(
      'class="text-lg font-extrabold lowercase sr-only md:not-sr-only"',
    );
  });
});
