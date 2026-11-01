// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));

vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
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
});
