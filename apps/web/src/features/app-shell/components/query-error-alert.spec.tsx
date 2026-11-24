// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../../../test/dom/render.js';
import { ApiError } from '../../../lib/errors/api-error.js';

vi.mock('next/navigation.js', () => ({
  usePathname: () => '/projects',
  useSearchParams: () => new URLSearchParams('state=archived'),
}));

const { QueryErrorAlert } = await import('./query-error-alert.js');
const { RateLimitedMessage } = await import('./rate-limited-message.js');

const REFUSAL = new ApiError(429, 'request.rate_limited', [], 45);

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('QueryErrorAlert', () => {
  it('shows the message of any other failure', () => {
    renderInApp(
      <QueryErrorAlert
        error={new ApiError(500, 'server.internal_error')}
        message="Something went wrong."
        headingLevel={2}
      />,
    );

    expect(screen.getByRole('alert').textContent).toBe('Something went wrong.');
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('shows the wait of a refusal and Reload page to the address with its filters (#433)', () => {
    renderInApp(<QueryErrorAlert error={REFUSAL} message="Never shown." headingLevel={4} />);

    const alert = screen.getByRole('alert');
    expect(within(alert).getByRole('heading', { level: 4 }).textContent).toBe('Too many requests');
    expect(alert.textContent).toContain('Try again in 45 seconds.');
    expect(alert.textContent).not.toContain('Never shown.');
    expect(within(alert).getByRole('link', { name: 'Reload page' }).getAttribute('href')).toBe(
      '/projects?state=archived',
    );
  });

  it('leaves out Reload page below the pages a list keeps (#434)', () => {
    renderInApp(
      <QueryErrorAlert error={REFUSAL} message="" headingLevel={3} offersReload={false} />,
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Try again in 45 seconds.');
    expect(within(alert).queryByRole('link')).toBeNull();
    expect(within(alert).queryByRole('button')).toBeNull();
  });

  it('reloads an address with a fragment with a button, as a link would only scroll (#433)', () => {
    window.history.replaceState(null, '', '/invitations#token=abc');
    renderInApp(<QueryErrorAlert error={REFUSAL} message="" headingLevel={2} />);

    const alert = screen.getByRole('alert');
    expect(within(alert).getByRole('button', { name: 'Reload page' })).toBeTruthy();
    expect(within(alert).queryByRole('link')).toBeNull();
  });
});

describe('RateLimitedMessage', () => {
  it('calls onReload from its Reload page button', async () => {
    const onReload = vi.fn();
    const events = userEvent.setup();
    renderInApp(<RateLimitedMessage retryAfterSeconds={45} headingLevel={4} onReload={onReload} />);

    await events.click(screen.getByRole('button', { name: 'Reload page' }));

    expect(onReload).toHaveBeenCalledOnce();
  });
});
