// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/dom/render.js';
import RootError from './error.js';
import PortalError from './(portal)/error.js';
import TeamError from './(team)/error.js';

afterEach(() => {
  cleanup();
});

// The error pages of the route groups replace the untranslated error page of Next.js (#382).
describe.each([
  ['the root', RootError],
  ['the team views', TeamError],
  ['the portal', PortalError],
])('error.tsx of %s', (_, errorPage) => {
  const ErrorPage = errorPage;
  it.each([
    ['en', 'Something went wrong', 'Trybun could not show this page.', 'Try again'],
    ['pl', 'Coś poszło nie tak', 'Trybun nie mógł wyświetlić tej strony.', 'Spróbuj ponownie'],
  ] as const)('says so in the language of the person (%s)', (locale, title, text, tryAgain) => {
    renderInApp(<ErrorPage error={new Error('digest only')} retry={vi.fn()} />, { locale });

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeDefined();
    expect(screen.getByText(text, { exact: false })).toBeDefined();
    expect(screen.getByRole('button', { name: tryAgain })).toBeDefined();
  });

  it('renders the route again on Try again', async () => {
    const events = userEvent.setup();
    const retry = vi.fn();
    renderInApp(<ErrorPage error={new Error('digest only')} retry={retry} />);

    await events.click(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('error.tsx of the root', () => {
  it('is a page of its own, as it replaces everything below the root layout', () => {
    renderInApp(<RootError error={new Error('digest only')} retry={vi.fn()} />);

    expect(screen.getByRole('main').contains(screen.getByRole('heading', { level: 1 }))).toBe(true);
  });
});

describe('error.tsx of a route group', () => {
  it.each([TeamError, PortalError])('stays inside the main area of the shell', (errorPage) => {
    const ErrorPage = errorPage;
    renderInApp(<ErrorPage error={new Error('digest only')} retry={vi.fn()} />);

    expect(screen.queryByRole('main')).toBeNull();
  });
});
