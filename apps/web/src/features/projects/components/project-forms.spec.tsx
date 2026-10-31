// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Project } from '@trybun/contracts/projects';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));

vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));

const { ProjectGeneralForm } = await import('./project-general-form.js');

const fake = createFakeApiClient();
api.current = fake.client;

const project: Project = {
  id: '0199a3f0-0000-7000-8000-000000000010',
  name: 'Customer portal',
  key: 'CP',
  state: 'active',
  confirmResolution: false,
  version: 3,
  createdAt: '2026-10-27T09:00:00.000Z',
  updatedAt: '2026-10-27T09:00:00.000Z',
  role: null,
  allowedActions: ['read', 'update', 'update_settings'],
};

afterEach(() => {
  cleanup();
  fake.reset();
});

describe('ProjectGeneralForm', () => {
  // A required field names itself when it is empty (§18.5), instead of calling it too short.
  it.each([
    ['en', 'Name', 'Enter the name of the project'],
    ['pl', 'Nazwa', 'Podaj nazwę projektu'],
  ] as const)('asks for the name of the project (%s)', async (locale, label, message) => {
    const events = userEvent.setup();
    renderInApp(<ProjectGeneralForm project={project} />, { locale });

    await events.clear(screen.getByRole('textbox', { name: label }));
    await events.type(screen.getByRole('textbox', { name: label }), '{Enter}');

    expect(await screen.findByText(message)).toBeDefined();
    expect(fake.calls).toHaveLength(0);
  });
});
