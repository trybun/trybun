// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../../../test/dom/render.js';

// Outside the App Router of Next.js: a plain link.
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));

const { NewTicketButton } = await import('./new-ticket-button.js');

afterEach(cleanup);

describe('NewTicketButton', () => {
  it.each([
    ['en', 'New ticket'],
    ['pl', 'Nowe zgłoszenie'],
  ] as const)('links to the full form with its name also as an icon (%s)', (locale, name) => {
    renderInApp(<NewTicketButton />, { locale });

    const link = screen.getByRole('link', { name });
    expect(link.getAttribute('href')).toBe('/tickets/new');
    // An icon with a 44 px target on phones, the text from the tablet width on (§2.9).
    expect(link.className).toMatch(/(^| )h-11( |$)/);
    expect(link.className).toMatch(/(^| )w-11( |$)/);
    expect(screen.getByText(name).className).toContain('sr-only md:not-sr-only');
  });
});
