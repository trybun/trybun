import { CATALOGUES } from '@trybun/i18n/catalogues';
import { createFormatter, createTranslator } from 'next-intl';
import { prerender } from 'react-dom/static';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../lib/errors/api-error.js';

let locale: 'en' | 'pl' = 'en';
const NOW = Date.parse('2026-11-18T12:00:00.000Z');
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: 'rateLimited') =>
    Promise.resolve(createTranslator({ locale, messages: CATALOGUES[locale], namespace })),
  getFormatter: () => Promise.resolve(createFormatter({ locale, timeZone: 'UTC' })),
  getNow: () => Promise.resolve(new Date(NOW)),
}));

vi.mock('next/headers.js', () => ({
  headers: () => Promise.resolve(requestHeaders),
}));
let requestHeaders = new Headers();

const { RateLimitedNotice } = await import('./rate-limited-notice.js');

async function html(retryAfterSeconds?: number, headingLevel?: 1 | 2): Promise<string> {
  const error = new ApiError(429, 'request.rate_limited', [], retryAfterSeconds);
  const { prelude } = await prerender(
    await RateLimitedNotice({
      error,
      ...(headingLevel === undefined ? {} : { headingLevel }),
    }),
  );
  return new Response(prelude).text();
}

describe('RateLimitedNotice', () => {
  beforeEach(() => {
    locale = 'en';
    requestHeaders = new Headers({ 'x-trybun-request-path': '/admin/accounts?kind=team' });
  });

  it('says when to try again, from Retry-After', async () => {
    const page = await html(45);

    expect(page).toContain('<h1 class="text-2xl font-bold">Too many requests</h1>');
    expect(page).toContain('Try again in 45 seconds.');
  });

  it('says it in Polish', async () => {
    locale = 'pl';

    const page = await html(120, 2);

    expect(page).toContain('<h2 class="text-xl font-bold">Zbyt wiele żądań</h2>');
    expect(page).toContain('Spróbuj ponownie za 2 minuty.');
  });

  it.each([
    ['without Retry-After', undefined],
    ['when there is nothing to wait', 0],
  ])('asks to wait a moment %s', async (_case, seconds) => {
    expect(await html(seconds)).toContain('Wait a moment and try again.');
  });

  it('reloads the address of the page with a touch target of 44 px (Rule 9)', async () => {
    const page = await html(45);

    expect(page).toMatch(
      /<a href="\/admin\/accounts\?kind=team" class="[^"]*\bh-11\b[^"]*">Reload page<\/a>/,
    );
  });

  it('reloads the start page when the address is unknown (a link prefetch)', async () => {
    requestHeaders = new Headers();

    expect(await html(45)).toContain('<a href="/"');
  });
});
