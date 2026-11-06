// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));
const push = vi.fn();
vi.mock('next/navigation.js', () => ({ useRouter: () => ({ push }) }));
const toastAdd = vi.hoisted(() => vi.fn());
vi.mock('@trybun/ui/components/toast', () => ({ toast: { add: toastAdd } }));

// The editor adapts its toolbar to the width (jsdom has no `matchMedia`): a phone.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

const { NewTicketForm } = await import('./new-ticket-form.js');

const fake = createFakeApiClient();
api.current = fake.client;
const PROJECT_ID = '0199a3f0-0000-7000-8000-000000000010';

afterEach(() => {
  cleanup();
  fake.reset();
  push.mockClear();
  toastAdd.mockClear();
});

describe('NewTicketForm', () => {
  it.each([
    ['en', 'Description', 'What happened?\nWhat did you expect?\nHow can we reproduce it?'],
    ['pl', 'Opis', 'Co się stało?\nCzego się spodziewałeś?\nJak możemy to powtórzyć?'],
  ] as const)(
    'shows the end-user template as the placeholder of the description (%s, §3.4)',
    async (locale, label, placeholder) => {
      renderInApp(<NewTicketForm projectId={PROJECT_ID} />, { locale });

      expect(
        // The editor loads lazily; its first import takes longer under the whole suite.
        (await screen.findByRole('textbox', { name: label }, { timeout: 5_000 })).getAttribute(
          'placeholder',
        ),
      ).toBe(placeholder);
    },
  );

  it('creates the ticket and opens it with a toast', async () => {
    const events = userEvent.setup();
    fake.on('POST /api/v1/tickets', { status: 201, data: { identifier: 'CP-7' } });
    renderInApp(<NewTicketForm projectId={PROJECT_ID} />);

    await events.type(screen.getByRole('textbox', { name: 'Title' }), 'Invoice PDF is empty');
    await events.type(await screen.findByRole('textbox', { name: 'Description' }), 'Since Monday');
    await events.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/portal/tickets/CP-7'));
    expect(fake.callsTo('POST /api/v1/tickets')[0]?.init).toMatchObject({
      body: { projectId: PROJECT_ID, title: 'Invoice PDF is empty', description: 'Since Monday' },
    });
    expect(toastAdd).toHaveBeenCalledWith({ title: 'Ticket CP-7 created', type: 'success' });
  });

  it('asks for a title without sending anything', async () => {
    const events = userEvent.setup();
    renderInApp(<NewTicketForm projectId={PROJECT_ID} />);

    await events.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Enter a title.')).toBeDefined();
    expect(fake.calls).toHaveLength(0);
  });

  it('shows a field error of the API at its field', async () => {
    const events = userEvent.setup();
    fake.on('POST /api/v1/tickets', {
      status: 422,
      error: {
        type: 'about:blank',
        title: 'Unprocessable Content',
        status: 422,
        code: 'request.validation_failed',
        errors: [{ pointer: '/title', code: 'string.too_long', detail: 'Too long' }],
      },
    });
    renderInApp(<NewTicketForm projectId={PROJECT_ID} />);

    await events.type(screen.getByRole('textbox', { name: 'Title' }), 'A title');
    await events.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('aria-invalid')).toBe(
        'true',
      ),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('creates one ticket on a double press (Q20)', async () => {
    const events = userEvent.setup();
    let answer: () => void = () => undefined;
    fake.client.POST.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = () =>
            resolve({
              data: { identifier: 'CP-7' },
              response: new Response(null, { status: 201 }),
            });
        }),
    );
    renderInApp(<NewTicketForm projectId={PROJECT_ID} />);

    await events.type(screen.getByRole('textbox', { name: 'Title' }), 'Invoice PDF is empty');
    const submit = screen.getByRole('button', { name: 'Submit' });
    await events.click(submit);
    await events.click(submit);

    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(true));
    expect(fake.client.POST).toHaveBeenCalledOnce();
    answer();
    await waitFor(() => expect(push).toHaveBeenCalledOnce());
  });
});
