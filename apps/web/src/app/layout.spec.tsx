import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RootLayout from './layout.js';
import HomePage from './page.js';

describe('RootLayout', () => {
  it('renders the page inside the document', () => {
    expect(
      renderToStaticMarkup(
        <RootLayout>
          <HomePage />
        </RootLayout>,
      ),
    ).toBe('<html lang="en"><head></head><body><main></main></body></html>');
  });
});
