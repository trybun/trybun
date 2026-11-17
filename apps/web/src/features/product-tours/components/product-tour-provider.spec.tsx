// @vitest-environment jsdom
import type { UserKind } from '@trybun/contracts/users';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));

vi.mock('client-only', () => ({}));
vi.mock('next/navigation.js', () => ({ usePathname: () => '/' }));
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));

const { ProductTourProvider, useProductTours } = await import('./product-tour-provider.js');

const fake = createFakeApiClient();
api.current = fake.client;

// The tour of the view is completed, so the provider only offers it and starts none.
const progress = [
  {
    tourId: 'first_login',
    tourVersion: 1,
    status: 'completed',
    updatedAt: '2026-11-03T09:15:00.000Z',
  },
];

function TourIds() {
  const { tours } = useProductTours();
  return <output aria-label="Tours">{tours.map(({ id }) => id).join(',')}</output>;
}

function renderProvider(audience: UserKind | undefined) {
  return renderInApp(
    <ProductTourProvider audience={audience}>
      <TourIds />
    </ProductTourProvider>,
  );
}

beforeEach(() => {
  fake.on('GET /api/v1/users/me/product-tours', { data: { items: progress, nextCursor: null } });
});

afterEach(() => {
  cleanup();
  fake.reset();
});

describe('ProductTourProvider', () => {
  it.each([
    ['team', 'first_login'],
    ['end_user', ''],
    [undefined, ''],
  ] as const)(
    'offers the tours of the view for the account kind %s from the layout',
    async (audience, tourIds) => {
      renderProvider(audience);

      await waitFor(() => {
        expect(fake.callsTo('GET /api/v1/users/me/product-tours')).toHaveLength(1);
      });
      expect(screen.getByRole('status', { name: 'Tours' }).textContent).toBe(tourIds);
    },
  );

  // #372: the account kind comes from the layout, so the provider – part of the first load of
  // the shell – needs no query of the users feature, whose module brings the Accounts page along.
  it('reads only the tour progress from the API, not the account', async () => {
    renderProvider('team');

    await waitFor(() => {
      expect(fake.callsTo('GET /api/v1/users/me/product-tours')).toHaveLength(1);
    });
    expect(fake.calls.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /api/v1/users/me/product-tours',
    ]);
  });
});
