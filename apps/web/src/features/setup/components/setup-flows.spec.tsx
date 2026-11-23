// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';
import { rateLimitedResult } from '../../../../test/factories/rate-limited.factory.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));

vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));
vi.mock('next/navigation.js', () => ({
  usePathname: () => '/setup',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));

const { SetupWizard } = await import('./setup-wizard.js');

const fake = createFakeApiClient();
api.current = fake.client;

const SETUP = { status: 'available', defaultLanguage: 'en', defaultTimeZone: 'UTC' } as const;

beforeEach(() => {
  fake.reset();
  window.location.hash = '#token=valid-token';
});
afterEach(cleanup);

describe('SetupWizard', () => {
  it('keeps its success message once its own creation completes the setup', async () => {
    let status: 'available' | 'completed' = 'available';
    fake.on('GET /api/v1/setup', () => ({ data: { ...SETUP, status } }));
    fake.on('POST /api/v1/setup/token-verification', () =>
      status === 'available'
        ? { data: SETUP }
        : { status: 409, error: { status: 409, code: 'setup.completed' } },
    );
    fake.on('POST /api/v1/setup/administrator', () => {
      status = 'completed';
      return { status: 201, data: { id: '0199a3f0-0000-7000-8000-0000000000aa' } };
    });
    const events = userEvent.setup();
    const { client } = renderInApp(<SetupWizard />);

    await events.type(await screen.findByRole('textbox', { name: 'First name' }), 'Ada');
    await events.type(screen.getByRole('textbox', { name: 'Last name' }), 'Admin');
    await events.type(screen.getByRole('textbox', { name: 'E-mail address' }), 'ada@example.com');
    await events.type(screen.getByLabelText('Password'), 'correct horse battery staple');
    await events.click(screen.getByRole('button', { name: 'Create Administrator account' }));

    expect(await screen.findByRole('heading', { name: 'Your account is ready' })).toBeTruthy();
    // The status of the setup is fetched again, e.g. on the return to the tab.
    await client.refetchQueries({ queryKey: ['setup'] });
    await waitFor(() => expect(fake.callsTo('GET /api/v1/setup').length).toBeGreaterThan(1));
    expect(screen.getByRole('heading', { name: 'Your account is ready' })).toBeTruthy();
    expect(screen.queryByText('Trybun is already set up')).toBeNull();
  });

  it('says that Trybun is set up once an Administrator exists', async () => {
    fake.on('GET /api/v1/setup', { data: { ...SETUP, status: 'completed' } });
    renderInApp(<SetupWizard />);

    expect(await screen.findByRole('heading', { name: 'Trybun is already set up' })).toBeTruthy();
  });

  it('says when to try again a refused check of the link, never that it is invalid (#433)', async () => {
    fake.on('GET /api/v1/setup', { data: SETUP });
    // The answer of the BFF with its `Retry-After: 45`.
    fake.client.POST.mockImplementationOnce(() => rateLimitedResult());
    renderInApp(<SetupWizard />);

    const alert = await screen.findByRole('alert');
    // `h2` under the `h1` of the page, as the setup messages.
    expect(within(alert).getByRole('heading', { level: 2 }).textContent).toBe('Too many requests');
    expect(alert.textContent).toContain('Try again in 45 seconds.');
    expect(screen.queryByText('This setup link is invalid or has expired')).toBeNull();
    // A link to the address would only scroll to the fragment, one without it would lose the
    // token: **Reload page** reloads the document instead.
    expect(within(alert).getByRole('button', { name: 'Reload page' })).toBeTruthy();
    expect(within(alert).queryByRole('link')).toBeNull();
  });

  it('says when to try again a refused read of the status, never that it is still checking (#433)', async () => {
    // The status and the check of the link share one limit (§14.4): the status is refused first.
    fake.client.GET.mockImplementationOnce(() => rateLimitedResult());
    renderInApp(<SetupWizard />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { level: 2 }).textContent).toBe('Too many requests');
    expect(alert.textContent).toContain('Try again in 45 seconds.');
    expect(screen.queryByText('Checking the setup link…')).toBeNull();
    expect(within(alert).getByRole('button', { name: 'Reload page' })).toBeTruthy();
  });

  it('shows the error of any other failed read of the status', async () => {
    fake.on('GET /api/v1/setup', { status: 500, error: {} });
    renderInApp(<SetupWizard />);

    expect((await screen.findByRole('alert')).textContent).not.toBe('');
    expect(screen.queryByText('Checking the setup link…')).toBeNull();
  });
});
