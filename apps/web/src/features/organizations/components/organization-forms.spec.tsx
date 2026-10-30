// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Organization } from '@trybun/contracts/organizations';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));

vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));

const { OrganizationDomains } = await import('./organization-domains.js');
const { OrganizationGeneralForm } = await import('./organization-general-form.js');

const fake = createFakeApiClient();
api.current = fake.client;

const organization: Organization = {
  id: '0199a3f0-0000-7000-8000-000000000020',
  name: 'Acme',
  state: 'active',
  domains: [],
  memberCount: 0,
  version: 1,
  createdAt: '2026-10-27T09:00:00.000Z',
  updatedAt: '2026-10-27T09:00:00.000Z',
  allowedActions: ['read', 'update'],
  projects: [],
};

afterEach(() => {
  cleanup();
  fake.reset();
});

// A required field names itself when it is empty (§18.5), instead of calling it too short.
describe.each([
  ['en', 'Name', 'Enter the name of the organization', 'Domain', 'Enter a domain'],
  ['pl', 'Nazwa', 'Podaj nazwę organizacji', 'Domena', 'Podaj domenę'],
] as const)('%s', (locale, nameLabel, nameRequired, domainLabel, domainRequired) => {
  it('asks for the name of the organization', async () => {
    const events = userEvent.setup();
    renderInApp(<OrganizationGeneralForm organization={organization} />, { locale });

    await events.clear(screen.getByRole('textbox', { name: nameLabel }));
    await events.type(screen.getByRole('textbox', { name: nameLabel }), ' {Enter}');

    expect(await screen.findByText(nameRequired)).toBeDefined();
    expect(fake.calls).toHaveLength(0);
  });

  it('asks for a domain', async () => {
    const events = userEvent.setup();
    renderInApp(<OrganizationDomains organization={organization} />, { locale });

    await events.type(screen.getByRole('textbox', { name: domainLabel }), '{Enter}');

    expect(await screen.findByText(domainRequired)).toBeDefined();
    expect(fake.calls).toHaveLength(0);
  });
});
